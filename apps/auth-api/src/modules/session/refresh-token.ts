import { randomBytes, createHash } from "node:crypto";

const REFRESH_TOKEN_BYTES = 32;

/**
 * Gera um refresh token opaco (não-JWT). 32 bytes hex = 64 chars.
 * O token plaintext é enviado ao cliente; só o hash SHA-256 é armazenado.
 */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
