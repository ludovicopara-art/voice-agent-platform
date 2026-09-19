// src/server.js
require("dotenv").config();
const express = require("express");
const twilio = require("twilio");
const prisma = require("./db");
const { interpretaTurno } = require("./claudeAgent");
const calendarService = require("./calendarService");
const googleOAuthRoutes = require("./googleOAuth");
const onboardingRoutes = require("./onboarding");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static("public"));

app.use(googleOAuthRoutes);
app.use(onboardingRoutes);

const { VoiceResponse } = twilio.twiml;
const sessioni = new Map(); // demo: in produzione usare Redis
const BASE_URL = process.env.BASE_URL;

/**
 * Cuore del multi-tenant: Twilio ci dice sempre su quale numero (`To`) è
 * arrivata la chiamata. Cerchiamo il tenant proprietario di quel numero.
 */
async function trovaTenantDaChiamata(req) {
  const numeroChiamato = req.body.To;
  return prisma.tenant.findUnique({ where: { twilioPhoneNumber: numeroChiamato } });
}

app.post("/voice", async (req, res) => {
  const callSid = req.body.CallSid;
  const tenant = await trovaTenantDaChiamata(req);
  const twiml = new VoiceResponse();

  if (!tenant || !tenant.active) {
    twiml.say({ language: "it-IT" }, "Questo servizio non è al momento disponibile.");
    return res.type("text/xml").send(twiml.toString());
  }

  sessioni.set(callSid, { history: [], tenantId: tenant.id });

  const gather = twiml.gather({
    input: "speech",
    language: "it-IT",
    speechTimeout: "auto",
    action: `${BASE_URL}/gather`,
    method: "POST",
  });
  gather.say(
    { language: "it-IT", voice: "Polly.Bianca" },
    `Buongiorno, ${tenant.businessName}, sono l'assistente virtuale. Come posso aiutarla?`
  );
  twiml.redirect(`${BASE_URL}/voice`);
  res.type("text/xml").send(twiml.toString());
});

app.post("/gather", async (req, res) => {
  const callSid = req.body.CallSid;
  const sessione = sessioni.get(callSid);
  const twiml = new VoiceResponse();

  if (!sessione) {
    twiml.say({ language: "it-IT" }, "Sessione scaduta, la preghiamo di richiamare.");
    return res.type("text/xml").send(twiml.toString());
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: sessione.tenantId } });
  const testoUtente = req.body.SpeechResult || "";
  sessione.history.push({ role: "user", content: testoUtente });

  const risultato = await interpretaTurno(sessione.history, tenant);
  sessione.history.push({ role: "assistant", content: JSON.stringify(risultato) });

  if (risultato.intent === "operatore" && tenant.humanOperatorNumber) {
    twiml.say({ language: "it-IT", voice: "Polly.Bianca" }, risultato.risposta_vocale);
    twiml.dial(tenant.humanOperatorNumber);
    sessioni.delete(callSid);
    return res.type("text/xml").send(twiml.toString());
  }

  if (!risultato.necessita_altre_info && risultato.intent === "prenota") {
    try {
      await gestisciPrenotazione(tenant, risultato, req.body.From);
    } catch (err) {
      console.error(`Errore calendario per tenant ${tenant.id}:`, err);
      risultato.risposta_vocale =
        "C'è un problema tecnico nel sistema di prenotazione. La contatteremo noi a breve.";
    }
    twiml.say({ language: "it-IT", voice: "Polly.Bianca" }, risultato.risposta_vocale);
    sessioni.delete(callSid);
    return res.type("text/xml").send(twiml.toString());
  }

  const gather = twiml.gather({
    input: "speech",
    language: "it-IT",
    speechTimeout: "auto",
    action: `${BASE_URL}/gather`,
    method: "POST",
  });
  gather.say({ language: "it-IT", voice: "Polly.Bianca" }, risultato.risposta_vocale);
  res.type("text/xml").send(twiml.toString());
});

async function gestisciPrenotazione(tenant, risultato, telefonoChiamante) {
  const { dati_raccolti } = risultato;
  const inizio = new Date(`${dati_raccolti.data_richiesta}T${dati_raccolti.ora_richiesta}:00`);
  const fine = new Date(inizio.getTime() + tenant.durataAppuntamentoMin * 60000);

  await calendarService.creaEvento(tenant, {
    summary: `${dati_raccolti.nome_cliente || "Cliente"}${
      dati_raccolti.numero_persone ? ` (${dati_raccolti.numero_persone} persone)` : ""
    }`,
    description: `Note: ${dati_raccolti.note || "nessuna"}\nTelefono: ${telefonoChiamante}`,
    inizioISO: inizio.toISOString(),
    fineISO: fine.toISOString(),
    extendedProps: { telefono: telefonoChiamante, tenantId: tenant.id },
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Piattaforma multi-tenant in ascolto sulla porta ${PORT}`));
