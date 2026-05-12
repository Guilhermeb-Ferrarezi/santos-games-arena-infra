import type { AuthApiEnv } from "../../../config/env";

export type OAuthProvider = "google" | "discord" | "steam";

export const oauthProviders = ["google", "discord", "steam"] as const;

export function isOAuthProvider(value: string): value is OAuthProvider {
  return oauthProviders.includes(value as OAuthProvider);
}

export function buildOAuthAuthorizationUrl(
  provider: OAuthProvider,
  env: Pick<
    AuthApiEnv,
    | "AUTH_PUBLIC_URL"
    | "GOOGLE_CLIENT_ID"
    | "DISCORD_CLIENT_ID"
    | "STEAM_API_KEY"
  >,
  state: string
) {
  const callbackUrl = buildOAuthCallbackUrl(provider, env);

  if (provider === "google") {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new Error("GOOGLE_CLIENT_ID is required");
    }

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (provider === "discord") {
    if (!env.DISCORD_CLIENT_ID) {
      throw new Error("DISCORD_CLIENT_ID is required");
    }

    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify email");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (!env.STEAM_API_KEY) {
    throw new Error("STEAM_API_KEY is required");
  }

  const url = new URL("https://steamcommunity.com/openid/login");
  url.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
  url.searchParams.set("openid.mode", "checkid_setup");
  url.searchParams.set("openid.return_to", callbackUrl);
  url.searchParams.set("openid.realm", resolvePublicUrl(env));
  url.searchParams.set("openid.identity", "http://specs.openid.net/auth/2.0/identifier_select");
  url.searchParams.set("openid.claimed_id", "http://specs.openid.net/auth/2.0/identifier_select");
  url.searchParams.set("state", state);
  return url.toString();
}

export function buildOAuthCallbackUrl(
  provider: OAuthProvider,
  env: Pick<AuthApiEnv, "AUTH_PUBLIC_URL">
) {
  return `${resolvePublicUrl(env)}/api/auth/oauth/${provider}/callback`;
}

function resolvePublicUrl(env: Pick<AuthApiEnv, "AUTH_PUBLIC_URL">) {
  return (env.AUTH_PUBLIC_URL ?? "http://localhost:3001").replace(/\/+$/, "");
}
