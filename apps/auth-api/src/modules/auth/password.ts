import type { AuthApiEnv } from "../../../config/env";

const encoder = new TextEncoder();

export async function verifyPassword(
  password: string,
  passwordHash: string,
  env: Pick<AuthApiEnv, "JWT_SECRET">
): Promise<boolean> {
  if (passwordHash.startsWith("sha256:")) {
    const expectedHash = await createLegacyPasswordHash(password, env.JWT_SECRET);
    return timingSafeEqual(passwordHash, expectedHash);
  }

  try {
    return await Bun.password.verify(password, passwordHash);
  } catch {
    return false;
  }
}

export async function createPasswordHash(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10
  });
}

export function needsPasswordSetup(passwordHash: string) {
  return passwordHash.startsWith("oauth:");
}

export async function createLegacyPasswordHash(
  password: string,
  secret: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(password));

  return `sha256:${Buffer.from(signature).toString("hex")}`;
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}
