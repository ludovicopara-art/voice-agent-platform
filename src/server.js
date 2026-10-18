function dataInFuso(dataStr, oraStr, tz) {
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataStr || "").trim());
  const m2 = /^(\d{1,2})(?::(\d{2}))?/.exec(String(oraStr || "").trim());
  if (!m1 || !m2) throw new Error(`Data/ora non valide: "${dataStr}" "${oraStr}"`);
  const guess = Date.UTC(+m1[1], +m1[2] - 1, +m1[3], +m2[1], +(m2[2] || 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const comeFuso = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (comeFuso - guess));
}

async function gestisciPrenotazione(tenant, risultato, telefonoChiamante) {
  const { dati_raccolti } = risultato;
  console.log("Dati prenotazione:", JSON.stringify(dati_raccolti));
  const inizio = dataInFuso(dati_raccolti.data_richiesta, dati_raccolti.ora_richiesta, tenant.timezone || "Europe/Rome");
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
