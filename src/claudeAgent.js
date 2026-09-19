// src/claudeAgent.js
const Anthropic = require("@anthropic-ai/sdk");
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function costruisciSystemPrompt(tenant) {
    const vincoloGruppo = tenant.maxPartySizeNoHuman
      ? `Se la richiesta supera ${tenant.maxPartySizeNoHuman} persone, usa intent operatore.`
          : "";
    return `Sei la segretaria virtuale di "${tenant.businessName}" (${tenant.businessType}).
    Orari: ${tenant.openingHours}. Indirizzo: ${tenant.address}.
    Compito: prenotare, spostare, cancellare appuntamenti, confermare prenotazioni, info orari.
    ${vincoloGruppo}
    Non dare consigli clinici o legali: usa intent operatore.
    Rispondi SOLO con JSON valido senza altro testo:
    {"intent":"prenota","dati_raccolti":{"nome_cliente":null,"numero_persone":null,"data_richiesta":null,"ora_richiesta":null,"note":null},"necessita_altre_info":true,"risposta_vocale":"..."}`;
}

async function interpretaTurno(history, tenant) {
    const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          system: costruisciSystemPrompt(tenant),
          messages: history,
    });
    const testo = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    try { return JSON.parse(testo); }
    catch { return { intent: "altro", dati_raccolti: {}, necessita_altre_info: true, risposta_vocale: "Scusi, puo ripetere?" }; }
}

module.exports = { interpretaTurno };
