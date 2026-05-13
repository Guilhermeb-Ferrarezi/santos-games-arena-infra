import { describe, expect, test } from "bun:test";

import { parseAuthApiEnv } from "../src/config/env";
import { createPasswordHash } from "../src/modules/auth/password";
import type { ExternalAuthAccountRepository } from "../src/modules/oauth/external-auth-account-repository";
import type { OAuthClient } from "../src/modules/oauth/oauth-client";
import type { PlatformUserRepository } from "../src/modules/users/platform-user-repository";
import { createAuthApiServer } from "../src/server";

const env = parseAuthApiEnv({
  DATABASE_URL: "postgres://postgres:secret@localhost:5432/sga_db",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "a".repeat(32),
  AUTH_PUBLIC_URL: "https://auth.santos-games.com",
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
  DISCORD_CLIENT_ID: "discord-client",
  DISCORD_CLIENT_SECRET: "discord-secret",
  STEAM_API_KEY: "steam-key"
});

describe("oauth routes", () => {
  test("redirects to google authorization url", async () => {
    const server = createAuthApiServer({ env });

    const response = await server.inject({
      method: "GET",
      url: "/api/auth/oauth/google/start"
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(response.headers.location).toContain("client_id=google-client");
    expect(response.headers.location).toContain("redirect_uri=https%3A%2F%2Fauth.santos-games.com%2Fapi%2Fauth%2Foauth%2Fgoogle%2Fcallback");

    await server.close();
  });

  test("callback logs in linked user and sets session cookie", async () => {
    const users = createUsersRepository();
    const linkedUser = {
      id: 1,
      email: "player@santos-games.com",
      login: "player",
      passwordHash: await createPasswordHash("secret123"),
      isActive: true
    };
    const externalAccounts = createExternalAccountsRepository(linkedUser);
    const oauthClient = createOAuthClient({
      provider: "google",
      externalAccountId: "google-1",
      email: "player@santos-games.com",
      login: "player",
      displayName: "Player"
    });
    const server = createAuthApiServer({
      env,
      externalAccounts,
      oauthClient,
      users
    });

    const start = await server.inject({
      method: "GET",
      url: "/api/auth/oauth/google/start"
    });
    const state = new URL(String(start.headers.location)).searchParams.get("state");

    const response = await server.inject({
      method: "GET",
      url: `/api/auth/oauth/google/callback?code=code-1&state=${encodeURIComponent(String(state))}`
    });

    const setCookie = Array.isArray(response.headers["set-cookie"])
      ? response.headers["set-cookie"].join("; ")
      : response.headers["set-cookie"];

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("https://santos-games.com");
    expect(setCookie).toContain("sg_auth=");
    expect(externalAccounts.linked.length).toBe(0);

    await server.close();
  });

  test("callback redirects to password setup when linked user has no password", async () => {
    const users = createUsersRepository();
    const linkedUser = {
      id: 1,
      email: "player@santos-games.com",
      login: "player",
      passwordHash: "oauth:google:google-1",
      isActive: true
    };
    const externalAccounts = createExternalAccountsRepository(linkedUser);
    const oauthClient = createOAuthClient({
      provider: "google",
      externalAccountId: "google-1",
      email: "player@santos-games.com",
      login: "player",
      displayName: "Player"
    });
    const server = createAuthApiServer({
      env,
      externalAccounts,
      oauthClient,
      users
    });

    const start = await server.inject({
      method: "GET",
      url: "/api/auth/oauth/google/start"
    });
    const state = new URL(String(start.headers.location)).searchParams.get("state");

    const response = await server.inject({
      method: "GET",
      url: `/api/auth/oauth/google/callback?code=code-1&state=${encodeURIComponent(String(state))}`
    });

    expect(response.statusCode).toBe(302);
    expect(new URL(String(response.headers.location)).pathname).toBe("/set-password");
    expect(new URL(String(response.headers.location)).searchParams.get("toast")).toContain(
      "ainda nao tem senha"
    );

    await server.close();
  });

  test("callback from register flow creates user and redirects to password setup", async () => {
    const users = createUsersRepository();
    const externalAccounts = createExternalAccountsRepository();
    const oauthClient = createOAuthClient({
      provider: "google",
      externalAccountId: "google-1",
      email: "player@santos-games.com",
      login: "player",
      displayName: "Player"
    });
    const server = createAuthApiServer({
      env,
      externalAccounts,
      oauthClient,
      users
    });

    const start = await server.inject({
      method: "GET",
      url: "/api/auth/oauth/google/start?returnTo=https%3A%2F%2Fsantos-games.com%2Flol%2Fnexus&entry=register"
    });
    const state = new URL(String(start.headers.location)).searchParams.get("state");

    const response = await server.inject({
      method: "GET",
      url: `/api/auth/oauth/google/callback?code=code-1&state=${encodeURIComponent(String(state))}`
    });

    expect(response.statusCode).toBe(302);
    expect(new URL(String(response.headers.location)).pathname).toBe("/set-password");
    expect(new URL(String(response.headers.location)).searchParams.get("returnTo")).toBe(
      "https://santos-games.com/lol/nexus"
    );
    expect(new URL(String(response.headers.location)).searchParams.get("provider")).toBe("google");
    expect(externalAccounts.linked).toHaveLength(1);
    expect(await users.findByIdentifier("player@santos-games.com")).not.toBeNull();

    await server.close();
  });

  test("callback without linked user from login flow returns to login page", async () => {
    const users = createUsersRepository();
    const externalAccounts = createExternalAccountsRepository();
    const oauthClient = createOAuthClient({
      provider: "google",
      externalAccountId: "google-1",
      email: "player@santos-games.com",
      login: "player",
      displayName: "Player"
    });
    const server = createAuthApiServer({
      env,
      externalAccounts,
      oauthClient,
      users
    });

    const start = await server.inject({
      method: "GET",
      url: "/api/auth/oauth/google/start?entry=login"
    });
    const state = new URL(String(start.headers.location)).searchParams.get("state");

    const response = await server.inject({
      method: "GET",
      url: `/api/auth/oauth/google/callback?code=code-1&state=${encodeURIComponent(String(state))}`
    });

    const loginUrl = new URL(String(response.headers.location));

    expect(response.statusCode).toBe(302);
    expect(loginUrl.pathname).toBe("/");
    expect(loginUrl.searchParams.get("toast")).toContain(
      "Nenhuma conta vinculada ao Google"
    );

    await server.close();
  });

  test("callback rejects invalid state", async () => {
    const server = createAuthApiServer({ env });

    const response = await server.inject({
      method: "GET",
      url: "/api/auth/oauth/google/callback?code=code-1&state=invalid"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "invalid_oauth_state",
      message: "Estado OAuth invalido."
    });

    await server.close();
  });

  test("rejects unsupported provider", async () => {
    const server = createAuthApiServer({ env });

    const response = await server.inject({
      method: "GET",
      url: "/api/auth/oauth/github/start"
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });

  test("steam authorization url keeps state in return_to", async () => {
    const server = createAuthApiServer({ env });

    const response = await server.inject({
      method: "GET",
      url: "/api/auth/oauth/steam/start"
    });

    expect(response.statusCode).toBe(302);

    const steamUrl = new URL(String(response.headers.location));
    const returnTo = steamUrl.searchParams.get("openid.return_to");

    expect(steamUrl.origin).toBe("https://steamcommunity.com");
    expect(returnTo).not.toBeNull();
    expect(new URL(String(returnTo)).searchParams.get("state")).toBeTruthy();

    await server.close();
  });
});

function createUsersRepository(): PlatformUserRepository {
  const users = new Map<number, {
    id: number;
    email: string;
    login: string;
    passwordHash: string;
    isActive: boolean;
  }>();

  return {
    async findByIdentifier(identifier) {
      return [...users.values()].find(
        (user) => user.email === identifier || user.login === identifier
      ) ?? null;
    },
    async findById(userId) {
      return users.get(userId) ?? null;
    },
    async createUser(input) {
      const user = {
        id: users.size + 1,
        email: input.email,
        login: input.login,
        passwordHash: input.passwordHash,
        isActive: true
      };
      users.set(user.id, user);
      return user;
    },
    async createOAuthUser(input) {
      const user = {
        id: users.size + 1,
        email: input.email,
        login: input.login,
        passwordHash: `oauth:${input.provider}:${input.externalAccountId}`,
        isActive: true
      };
      users.set(user.id, user);
      return user;
    },
    async updatePassword() {},
    async updateLastLogin() {}
  };
}

function createExternalAccountsRepository(
  linkedUser: {
    id: number;
    email: string;
    login: string;
    passwordHash: string;
    isActive: boolean;
  } | null = null
): ExternalAuthAccountRepository & { linked: unknown[] } {
  const linked: unknown[] = [];

  return {
    linked,
    async findLinkedUser() {
      return linkedUser;
    },
    async linkToUser(input) {
      linked.push(input);
    }
  };
}

function createOAuthClient(profile: Awaited<ReturnType<OAuthClient["exchangeCodeForProfile"]>>): OAuthClient {
  return {
    async exchangeCodeForProfile() {
      return profile;
    }
  };
}
