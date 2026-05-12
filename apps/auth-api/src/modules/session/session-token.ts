import type { AuthApiEnv } from "../../../config/env";

export type SessionTokenUser = {
  userId: number;
  email: string;
  login: string;
  sessionId?: string;
};

export type VerifiedSessionToken = SessionTokenUser & {
  sessionId: string | null;
  expiresAt: number;
};

type SessionTokenPayload = SessionTokenUser & {
  exp: number;
};

const encoder = new TextEncoder();

export async function createSessionToken(
  user: SessionTokenUser,
  env: Pick<AuthApiEnv, "JWT_SECRET" | "SESSION_TTL_SECONDS">
): Promise<string> {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const payload: SessionTokenPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + env.SESSION_TTL_SECONDS
  };

  const unsignedToken = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;
  const signature = await sign(unsignedToken, env.JWT_SECRET);

  return `${unsignedToken}.${signature}`;
}

export async function verifySessionToken(
  token: string,
  env: Pick<AuthApiEnv, "JWT_SECRET">
): Promise<VerifiedSessionToken | null> {
  const [encodedHeader, encodedPayload, signature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = await sign(unsignedToken, env.JWT_SECRET);

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  const payload = parsePayload(encodedPayload);
  if (!payload) {
    return null;
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    userId: payload.userId,
    email: payload.email,
    login: payload.login,
    sessionId: typeof payload.sessionId === "string" ? payload.sessionId : null,
    expiresAt: payload.exp
  };
}

function parsePayload(encodedPayload: string): SessionTokenPayload | null {
  try {
    const decoded = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<SessionTokenPayload>;

    if (
      typeof decoded.userId !== "number" ||
      typeof decoded.email !== "string" ||
      typeof decoded.login !== "string" ||
      typeof decoded.exp !== "number"
    ) {
      return null;
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      login: decoded.login,
      sessionId: typeof decoded.sessionId === "string" ? decoded.sessionId : undefined,
      exp: decoded.exp
    };
  } catch {
    return null;
  }
}

async function sign(value: string, secret: string): Promise<string> {
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
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncodeBytes(encoder.encode(JSON.stringify(value)));
}

function base64UrlEncodeBytes(value: Uint8Array): string {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);

  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
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
