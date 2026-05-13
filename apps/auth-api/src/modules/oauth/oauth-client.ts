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
  exchangeSteamOpenId(query: SteamOpenIdQuery): Promise<OAuthProfile>;
};

export type SteamOpenIdQuery = Record<string, string | string[] | undefined>;

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
    },

    async exchangeSteamOpenId(query) {
      return exchangeSteamOpenIdProfile(env, query);
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

async function exchangeSteamOpenIdProfile(
  env: Pick<AuthApiEnv, "STEAM_API_KEY">,
  query: SteamOpenIdQuery
): Promise<OAuthProfile> {
  if (!env.STEAM_API_KEY) {
    throw new Error("Steam OAuth is not configured");
  }

  const mode = getSingleQueryValue(query, "openid.mode");
  if (mode !== "id_res") {
    throw new Error("Invalid Steam OpenID response");
  }

  const claimedId =
    getSingleQueryValue(query, "openid.claimed_id") ?? getSingleQueryValue(query, "openid.identity");
  const steamId = extractSteamId(claimedId);
  if (!steamId) {
    throw new Error("Invalid Steam identifier");
  }

  const verificationResponse = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: buildSteamVerificationBody(query)
  });

  if (!verificationResponse.ok) {
    throw new Error(`Steam OpenID verification failed with ${verificationResponse.status}`);
  }

  const verificationBody = await verificationResponse.text();
  if (!verificationBody.includes("is_valid:true")) {
    throw new Error("Steam OpenID response is not valid");
  }

  const persona = await fetchSteamPersona(env.STEAM_API_KEY, steamId);

  return {
    provider: "steam",
    externalAccountId: steamId,
    email: `${steamId}@steam.oauth.santos-games.local`,
    login: `steam_${steamId}`,
    displayName: persona?.displayName ?? `Steam ${steamId}`,
    avatarUrl: persona?.avatarUrl
  };
}

function buildSteamVerificationBody(query: SteamOpenIdQuery) {
  const params = new URLSearchParams();
  params.set("openid.mode", "check_authentication");

  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith("openid.") || key === "openid.mode") {
      continue;
    }

    const normalized = getSingleQueryValue(query, key);
    if (normalized !== undefined) {
      params.set(key, normalized);
    }
  }

  return params;
}

async function fetchSteamPersona(
  apiKey: string,
  steamId: string
): Promise<{ displayName?: string; avatarUrl?: string } | null> {
  const response = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}&steamids=${encodeURIComponent(steamId)}`
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    response?: {
      players?: Array<{
        personaname?: string;
        avatarfull?: string;
      }>;
    };
  };

  const player = payload.response?.players?.[0];
  if (!player) {
    return null;
  }

  return {
    displayName: player.personaname,
    avatarUrl: player.avatarfull
  };
}

function getSingleQueryValue(query: SteamOpenIdQuery, key: string) {
  const value = query[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === "string" ? value : undefined;
}

function extractSteamId(value?: string) {
  if (!value) {
    return null;
  }

  const match = value.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/);
  return match?.[1] ?? null;
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
