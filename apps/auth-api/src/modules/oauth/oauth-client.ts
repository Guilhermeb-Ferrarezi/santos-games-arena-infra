import type { AuthApiEnv } from "../../../config/env";
import type { OAuthProvider } from "./providers";
import { buildOAuthCallbackUrl } from "./providers";

export type OAuthProfile = {
  provider: OAuthProvider;
  externalAccountId: string;
  email: string;
  login: string;
  displayName?: string;
  avatarUrl?: string;
};

export type OAuthClient = {
  exchangeCodeForProfile(provider: OAuthProvider, code: string): Promise<OAuthProfile>;
};

export function createOAuthClient(
  env: Pick<
    AuthApiEnv,
    | "AUTH_PUBLIC_URL"
    | "DISCORD_CLIENT_ID"
    | "DISCORD_CLIENT_SECRET"
    | "GOOGLE_CLIENT_ID"
    | "GOOGLE_CLIENT_SECRET"
    | "STEAM_API_KEY"
  >
): OAuthClient {
  return {
    async exchangeCodeForProfile(provider, code) {
      if (provider === "google") {
        return exchangeGoogleCode(env, code);
      }

      if (provider === "discord") {
        return exchangeDiscordCode(env, code);
      }

      return verifySteamOpenId(env, code);
    }
  };
}

async function exchangeGoogleCode(
  env: Pick<AuthApiEnv, "AUTH_PUBLIC_URL" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET">,
  code: string
): Promise<OAuthProfile> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth is not configured");
  }

  const token = await postForm<{ access_token: string }>("https://oauth2.googleapis.com/token", {
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: buildOAuthCallbackUrl("google", env),
    grant_type: "authorization_code"
  });
  const profile = await getJson<{
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  }>("https://openidconnect.googleapis.com/v1/userinfo", token.access_token);
  const email = profile.email ?? `${profile.sub}@google.oauth.santos-games.local`;

  return {
    provider: "google",
    externalAccountId: profile.sub,
    email,
    login: normalizeLogin(email),
    displayName: profile.name,
    avatarUrl: profile.picture
  };
}

async function exchangeDiscordCode(
  env: Pick<AuthApiEnv, "AUTH_PUBLIC_URL" | "DISCORD_CLIENT_ID" | "DISCORD_CLIENT_SECRET">,
  code: string
): Promise<OAuthProfile> {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    throw new Error("Discord OAuth is not configured");
  }

  const token = await postForm<{ access_token: string }>("https://discord.com/api/v10/oauth2/token", {
    code,
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    redirect_uri: buildOAuthCallbackUrl("discord", env),
    grant_type: "authorization_code"
  });
  const profile = await getJson<{
    id: string;
    username: string;
    global_name?: string | null;
    email?: string | null;
    avatar?: string | null;
  }>("https://discord.com/api/v10/users/@me", token.access_token);
  const email = profile.email ?? `${profile.id}@discord.oauth.santos-games.local`;

  return {
    provider: "discord",
    externalAccountId: profile.id,
    email,
    login: normalizeLogin(profile.username),
    displayName: profile.global_name ?? profile.username,
    avatarUrl: profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : undefined
  };
}

async function verifySteamOpenId(
  env: Pick<AuthApiEnv, "STEAM_API_KEY">,
  code: string
): Promise<OAuthProfile> {
  if (!env.STEAM_API_KEY) {
    throw new Error("Steam OAuth is not configured");
  }

  const steamId = code.trim();
  if (!/^\d{17}$/.test(steamId)) {
    throw new Error("Invalid Steam identifier");
  }

  return {
    provider: "steam",
    externalAccountId: steamId,
    email: `${steamId}@steam.oauth.santos-games.local`,
    login: `steam_${steamId}`,
    displayName: `Steam ${steamId}`
  };
}

async function postForm<T>(url: string, body: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(body)
  });

  if (!response.ok) {
    throw new Error(`OAuth token request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function getJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`OAuth profile request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function normalizeLogin(value: string) {
  return value
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || `user-${crypto.randomUUID().slice(0, 8)}`;
}
