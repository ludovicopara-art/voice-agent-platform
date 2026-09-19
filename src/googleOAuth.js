// src/googleOAuth.js
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

router.get("/oauth/google/start", (req, res) => {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).send("tenantId mancante");
    const url = getOAuthClient().generateAuthUrl({
          access_type: "offline", prompt: "consent",
          scope: ["https://www.googleapis.com/auth/calendar"],
          state: tenantId,
    });
    res.redirect(url);
});

router.get("/oauth/google/callback", async (req, res) => {
    const { code, state: tenantId } = req.query;
    if (!code || !tenantId) return res.status(400).send("Parametri mancanti");
    try {
          const { tokens } = await getOAuthClient().getToken(code);
          if (!tokens.refresh_token) return res.status(400).send("Nessun refresh token. Riprova.");
          await prisma.tenant.update({
                  where: { id: tenantId },
                  data: { googleRefreshTokenEnc: encrypt(tokens.refresh_token), googleCalendarId: "primary" },
          });
          res.send("Google Calendar collegato! Puoi chiudere questa pagina.");
    } catch (err) {
          console.error("Errore OAuth:", err);
          res.status(500).send("Errore durante il collegamento.");
    }
});

module.exports = router;
