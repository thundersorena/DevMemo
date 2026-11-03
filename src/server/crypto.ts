import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env";

/**
 * Symmetric encryption for secrets we must be able to read back (webhook
 * secrets). AES-256-GCM with a key derived from BETTER_AUTH_SECRET.
 * Format: base64url(iv).base64url(authTag).base64url(ciphertext)
 *
 * Note: rotating BETTER_AUTH_SECRET makes stored webhook secrets unreadable;
 * users then need to rotate their webhook secret in Settings.
 */
function key(): Buffer {
  return createHash("sha256").update(`devmemo:secrets:v1:${env().BETTER_AUTH_SECRET}`).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(payload: string): string {
  const [iv, tag, ciphertext] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !ciphertext) throw new Error("Malformed encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
