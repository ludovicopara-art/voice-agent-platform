// src/onboarding.js
// MVP: API per creare un nuovo cliente (tenant). In produzione questa rotta
// va protetta con autenticazione vera (es. la usi solo tu dal tuo pannello
// admin, oppure la colleghi a un form pubblico con verifica email/pagamento
// prima di creare il tenant).

const express = require("express");
const prisma = require("./db");

const router = express.Router();

// Protezione minima: richiede una chiave segreta condivisa nell'header.
// Sostituire con autenticazione vera prima del lancio pubblico.
function richiediChiaveAdmin(req, res, next) {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ errore: "Non autorizzato" });
  }
  next();
}

router.post("/admin/tenants", richiediChiaveAdmin, async (req, res) => {
  const {
    businessName,
    businessType,
    twilioPhoneNumber,
    timezone,
    openingHours,
    address,
    maxPartySizeNoHuman,
    humanOperatorNumber,
    durataAppuntamentoMin,
    capienzaTotale,
  } = req.body;

  if (!businessName || !twilioPhoneNumber || !openingHours || !address) {
    return res.status(400).json({ errore: "Campi obbligatori mancanti" });
  }

  try {
    const tenant = await prisma.tenant.create({
      data: {
        businessName,
        businessType: businessType || "generico",
        twilioPhoneNumber,
        timezone: timezone || "Europe/Rome",
        openingHours,
        address,
        maxPartySizeNoHuman,
        humanOperatorNumber,
        durataAppuntamentoMin: durataAppuntamentoMin || 60,
        capienzaTotale,
      },
    });

    res.json({
      tenant,
      linkCollegamentoCalendario: `${process.env.BASE_URL}/oauth/google/start?tenantId=${tenant.id}`,
    });
  } catch (err) {
    console.error("Errore creazione tenant:", err);
    res.status(500).json({ errore: "Impossibile creare il tenant (numero già in uso?)" });
  }
});

router.get("/admin/tenants", richiediChiaveAdmin, async (req, res) => {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
  res.json(tenants);
});

router.patch("/admin/tenants/:id", richiediChiaveAdmin, async (req, res) => {
  const tenant = await prisma.tenant.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(tenant);
});

module.exports = router;
