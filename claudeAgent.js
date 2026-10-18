async function interpretaTurno(history, tenant) {
  const oggi = new Date().toLocaleDateString("it-IT", {
    timeZone: tenant.timezone || "Europe/Rome",
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: costruisciSystemPrompt(tenant) + `\n\nOggi è ${oggi}. Interpreta date relative (domani, lunedì prossimo) rispetto a questa data e restituisci data_richiesta in formato YYYY-MM-DD e ora_richiesta in formato HH:MM.`,
      messages: history,
    });
    const testo = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
    const inizio = testo.indexOf("{");
    const fine = testo.lastIndexOf("}");
    if (inizio === -1 || fine === -1) throw new Error("Nessun JSON nella risposta: " + testo);
    return JSON.parse(testo.slice(inizio, fine + 1));
  } catch (err) {
    console.error("interpretaTurno errore:", err.message);
    return { intent: "altro", dati_raccolti: {}, necessita_altre_info: true, risposta_vocale: "Scusi, può ripetere?" };
  }
}
