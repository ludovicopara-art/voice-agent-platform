// src/crypto.js
// Cifra/decifra i refresh token OAuth dei clienti prima di salvarli su DB.
// ENCRYPTION_KEY deve essere una stringa hex di 64 caratteri (32 byte),
// generabile una sola volta con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// e conservata SOLO nelle variabili d'ambiente del server, mai nel codice o su git.

const crypto = require("crypto");

const KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const ALGO = "aes-256-gcm";

function encrypt(testoInChiaro) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(testoInChiaro, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Concateniamo iv + authTag + dati cifrati, tutto in base64, per salvarlo in un unico campo testo
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(testoCifrato) {
  const dati = Buffer.from(testoCifrato, "base64");
  const iv = dati.subarray(0, 12);
  const authTag = dati.subarray(12, 28);
  const encrypted = dati.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

module.exports = { encrypt, decrypt };
