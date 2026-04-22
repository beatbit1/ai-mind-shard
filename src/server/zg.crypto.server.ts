// AES-256-GCM helpers for encrypting memory blobs before upload to 0G Storage.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey(): Buffer {
  const hex = process.env.ZG_MEMORY_ENC_KEY;
  if (!hex) throw new Error("ZG_MEMORY_ENC_KEY missing");
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const buf = Buffer.from(clean, "hex");
  if (buf.length !== 32) throw new Error("ZG_MEMORY_ENC_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

// Encrypted blob layout: [12B IV][16B AuthTag][ciphertext]
export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decrypt(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
