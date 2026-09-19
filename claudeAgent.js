// src/claudeAgent.js
const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function costruisciSystemPrompt(tenant) {
  const vincoloGruppo = tenant.maxPartySizeNoHuman
    ? `Se la richiesta supera ${tenant.maxPartySizeNoHuman} persone, trasferisci a un operatore umano (intent "operatore").`
    : "";

  return `
Sei la segretaria telefonica virtuale di "${tenant.businessName}" (${tenant.businessType}).
Orari: ${tenant.openingHours}. Indirizzo: ${tenant.address}.

Il tuo compito:
- prenotare, spostare o cancellare un appuntamento/prenotazione
- confermare un appuntamento esistente
- rispondere a domande su orari e indirizzo
${vincoloGruppo}

Non dare mai consigli clinici, legali o specialistici: se richiesto, trasferisci
a un operatore umano (intent "operatore").

Rispondi SEMPRE e SOLO con un oggetto JSON valido:
{
  "intent": "prenota" | "sposta" | "cancella" | "conferma" | "info" | "operatore" | "altro",
  "dati_raccolti": {
    "nome_cliente": string|null,
    "numero_persone": number|null,
    "data_richiesta": string|null,
    "ora_richiesta": string|null,
    "note": string|null
  },
  "necessita_altre_info": boolean,
  "risposta_vocale": string
}
`.trim();
}

async function interpretaTurno(history, tenant) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: costruisciSystemPrompt(tenant),
    messages: history,
  });

  const testo = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");

  try {
    return JSON.parse(testo);
  } catch {
    return {
      intent: "altro",
      dati_raccolti: {},
      necessita_altre_info: true,
      risposta_vocale: "Scusi, non ho capito bene. Può ripetere per favore?",
    };
  }
}

module.exports = { interpretaTurno };
