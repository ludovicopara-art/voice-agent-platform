// src/googleOAuth.js
// Flusso "Connetti il tuo Google Calendar" per l'onboarding self-service.
// Il cliente clicca un link, autorizza su Google, e noi salviamo il refresh
// token (cifrato) associato al suo Tenant. Nessuna password passa da noi.

const express = require("express");
const { google } = require("googleapis");
const prisma = require("./db");
const { encrypt } = require("./crypto");

const router = express.Router();

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${process.env.BASE_URL}/oauth/google/callback`
  );
}

// Passo 1: il cliente clicca "Collega Google Calendar" nella dashboard di onboarding.
// tenantId identifica quale cliente sta autorizzando (lo passiamo come "state").
router.get("/oauth/google/start", (req, res) => {
  const { tenantId } = req.query;
  if (!tenantId) return res.status(400).send("tenantId mancante");

  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // necessario per ottenere il refresh_token
    prompt: "consent", // forza il consenso ogni volta, garantendo un refresh_token
    scope: ["https://www.googleapis.com/auth/calendar"],
    state: tenantId,
  });
  res.redirect(url);
});

// Passo 2: Google reindirizza qui con un "code" da scambiare per i token.
router.get("/oauth/google/callback", async (req, res) => {
  const { code, state: tenantId } = req.query;
  if (!code || !tenantId) return res.status(400).send("Parametri mancanti");

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      // Succede se il cliente aveva già autorizzato in passato senza "prompt=consent"
      return res
        .status(400)
        .send("Non ho ricevuto un refresh token. Riprova rimuovendo prima l'accesso da https://myaccount.google.com/permissions e ripetendo il collegamento.");
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        googleRefreshTokenEnc: encrypt(tokens.refresh_token),
        googleCalendarId: "primary", // MVP: usa il calendario principale del cliente
      },
    });

    res.send("Google Calendar collegato con successo! Puoi chiudere questa pagina.");
  } catch (err) {
    console.error("Errore OAuth Google:", err);
    res.status(500).send("Errore durante il collegamento a Google Calendar.");
  }
});

module.exports = router;
