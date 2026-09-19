// src/calendarService.js
// A differenza della versione precedente (un service account fisso), qui
// costruiamo un client Google OAuth diverso per OGNI tenant, usando il
// refresh token che ha salvato durante l'onboarding.

const { google } = require("googleapis");
const { decrypt } = require("./crypto");

function getOAuthClientForTenant(tenant) {
  if (!tenant.googleRefreshTokenEnc) {
    throw new Error(`Tenant ${tenant.id} non ha ancora collegato Google Calendar`);
  }
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: decrypt(tenant.googleRefreshTokenEnc) });
  return oauth2Client;
}

async function getCalendarClient(tenant) {
  const auth = getOAuthClientForTenant(tenant);
  return google.calendar({ version: "v3", auth });
}

async function eventiNellaFascia(tenant, inizioISO, fineISO) {
  const calendar = await getCalendarClient(tenant);
  const res = await calendar.events.list({
    calendarId: tenant.googleCalendarId || "primary",
    timeMin: inizioISO,
    timeMax: fineISO,
    singleEvents: true,
  });
  return res.data.items || [];
}

async function creaEvento(tenant, { summary, description, inizioISO, fineISO, extendedProps }) {
  const calendar = await getCalendarClient(tenant);
  const evento = await calendar.events.insert({
    calendarId: tenant.googleCalendarId || "primary",
    requestBody: {
      summary,
      description,
      start: { dateTime: inizioISO, timeZone: tenant.timezone },
      end: { dateTime: fineISO, timeZone: tenant.timezone },
      extendedProperties: { private: extendedProps || {} },
    },
  });
  return evento.data;
}

module.exports = { eventiNellaFascia, creaEvento };
