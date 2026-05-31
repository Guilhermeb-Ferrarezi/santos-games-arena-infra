import { OTP } from "otplib";
import { createHash, randomBytes } from "crypto";

const otp = new OTP();

export function generateTotpSecret(): string {
  return otp.generateSecret(20);
}

export function getTotpUri(secret: string, login: string, issuer = "Santos Games Arena"): string {
  return otp.generateURI({ label: login, issuer, secret });
}

export function verifyTotpCode(code: string, secret: string): boolean {
  try {
    return otp.verifySync({ token: code, secret }).valid;
  } catch {
    return false;
  }
}

export function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const hex = randomBytes(5).toString("hex").toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8)}`;
  });
}

export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.replace(/-/g, "").toUpperCase()).digest("hex");
}

export function verifyBackupCode(raw: string, hashes: string[]): { valid: boolean; remaining: string[] } {
  const attempt = hashBackupCode(raw);
  const idx = hashes.indexOf(attempt);
  if (idx === -1) return { valid: false, remaining: hashes };
  return { valid: true, remaining: hashes.filter((_, i) => i !== idx) };
}
