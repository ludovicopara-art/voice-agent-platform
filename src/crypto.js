// src/crypto.js
const crypto = require("crypto");
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const ALGO = "aes-256-gcm";

function encrypt(testo) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(testo, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
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
