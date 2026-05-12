import type { AuthApiEnv } from "../../../config/env";
import type { OAuthProvider } from "./providers";

const encoder = new TextEncoder();

type OAuthStatePayload = {
  provider: OAuthProvider;
  exp: number;
  nonce: string;
  returnTo: string;
};

export async function createOAuthState(
  provider: OAuthProvider,
  env: Pick<AuthApiEnv, "JWT_SECRET" | "OAUTH_STATE_TTL_SECONDS">,
  returnTo?: string
) {
  const payload: OAuthStatePayload = {
    provider,
    exp: Math.floor(Date.now() / 1000) + env.OAUTH_STATE_TTL_SECONDS,
    nonce: crypto.randomUUID(),
    returnTo: normalizeReturnTo(returnTo)
  };
  const encodedPayload = base64UrlEncodeJson(payload);
  const signature = await sign(encodedPayload, env.JWT_SECRET);

  return `${encodedPayload}.${signature}`;
}

export async function readOAuthState(
  state: string,
  provider: OAuthProvider,
  env: Pick<AuthApiEnv, "JWT_SECRET">
) {
  const [encodedPayload, signature] = state.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = await sign(encodedPayload, env.JWT_SECRET);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<OAuthStatePayload>;

    if (
      payload.provider === provider &&
      typeof payload.exp === "number" &&
      payload.exp > Math.floor(Date.now() / 1000) &&
      typeof payload.returnTo === "string"
    ) {
      return payload as OAuthStatePayload;
    }
  } catch {
    return null;
  }

  return null;
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

function normalizeReturnTo(returnTo?: string) {
  const fallback = "https://santos-games.com";

  if (!returnTo) {
    return fallback;
  }

  try {
    const url = new URL(returnTo, fallback);

    if (url.hostname === "santos-games.com" || url.hostname.endsWith(".santos-games.com")) {
      return url.toString();
    }
  } catch {
    return fallback;
  }

  return fallback;
}
