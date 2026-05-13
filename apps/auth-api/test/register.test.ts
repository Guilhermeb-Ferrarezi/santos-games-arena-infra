import { describe, expect, test } from "bun:test";

import { parseAuthApiEnv } from "../src/config/env";
import { createSessionToken } from "../src/modules/session/session-token";
import { createLegacyPasswordHash, verifyPassword } from "../src/modules/auth/password";
import type { ExternalAuthAccountRepository } from "../src/modules/oauth/external-auth-account-repository";
import type { PlatformUserRepository } from "../src/modules/users/platform-user-repository";
import { createMemorySessionStore } from "../src/modules/session/session-store";
import { createAuthApiServer } from "../src/server";

const env = parseAuthApiEnv({
  DATABASE_URL: "postgres://postgres:secret@localhost:5432/sga_db",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "a".repeat(32)
});

describe("auth register route", () => {
  test("creates a password account", async () => {
    const sessions = createMemorySessionStore();
    const users = createUsersRepository();
    const server = createAuthApiServer({ env, sessions, users });

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "player@santos-games.com",
        login: "player",
        password: "secret123"
      }
    });

    const setCookie = Array.isArray(response.headers["set-cookie"])
      ? response.headers["set-cookie"].join("; ")
      : response.headers["set-cookie"];

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      authenticated: true,
      user: {
        id: 1,
        email: "player@santos-games.com",
        login: "player"
      }
    });
    expect(setCookie).toContain("sg_auth=");
    expect(await users.findByIdentifier("player@santos-games.com")).not.toBeNull();
    expect(await verifyPassword("secret123", (await users.findByIdentifier("player@santos-games.com"))!.passwordHash, env)).toBe(true);
    expect(users.lastLoginUpdatedFor).toBe(1);

    await server.close();
  });

  test("links oauth account when provider data is supplied", async () => {
    const users = createUsersRepository();
    const externalAccounts = createExternalAccountsRepository();
    const server = createAuthApiServer({ env, externalAccounts, users });

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "player@santos-games.com",
        login: "player",
        password: "secret123",
        provider: "google",
        externalAccountId: "google-1",
        displayName: "Player"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(externalAccounts.linked).toHaveLength(1);
    expect(externalAccounts.linked[0]).toMatchObject({
      provider: "google",
      externalAccountId: "google-1",
      email: "player@santos-games.com",
      displayName: "Player",
      userId: 1
    });

    await server.close();
  });

  test("rejects duplicate email or login", async () => {
    const users = createUsersRepository({
      id: 1,
      email: "player@santos-games.com",
      login: "player",
      passwordHash: await createLegacyPasswordHash("secret123", env.JWT_SECRET),
      isActive: true
    });
    const server = createAuthApiServer({ env, users });

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "player@santos-games.com",
        login: "player-2",
        password: "secret123"
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "user_exists",
      message: "Ja existe uma conta com este email ou login."
    });

    await server.close();
  });
});

describe("auth password route", () => {
  test("sets a password hash for an authenticated oauth user", async () => {
    const sessions = createMemorySessionStore();
    const users = createUsersRepository({
      id: 1,
      email: "player@santos-games.com",
      login: "player",
      passwordHash: "oauth:google:google-1",
      isActive: true
    });
    await sessions.create({
      sessionId: "session-1",
      userId: 1,
      ttlSeconds: 60
    });

    const server = createAuthApiServer({ env, sessions, users });
    const token = await createSessionToken(
      {
        userId: 1,
        email: "player@santos-games.com",
        login: "player",
        sessionId: "session-1"
      },
      env
    );

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/password",
      cookies: {
        sg_auth: token
      },
      payload: {
        password: "newsecret123"
      }
    });

    const updatedUser = await users.findByIdentifier("player@santos-games.com");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true
    });
    expect(updatedUser).not.toBeNull();
    expect(updatedUser?.passwordHash).toContain("$2");
    expect(await verifyPassword("newsecret123", updatedUser!.passwordHash, env)).toBe(true);

    await server.close();
  });
});

function createUsersRepository(
  initialUser?: Awaited<ReturnType<PlatformUserRepository["findByIdentifier"]>>
): PlatformUserRepository & { lastLoginUpdatedFor: number | null } {
  const users = new Map<number, NonNullable<Awaited<ReturnType<PlatformUserRepository["findByIdentifier"]>>>>();

  if (initialUser) {
    users.set(initialUser.id, initialUser);
  }

  return {
    lastLoginUpdatedFor: null,
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
    async updatePassword(userId, passwordHash) {
      const user = users.get(userId);
      if (user) {
        user.passwordHash = passwordHash;
      }
    },
    async updateLastLogin(userId) {
      this.lastLoginUpdatedFor = userId;
    }
  };
}

function createExternalAccountsRepository(): ExternalAuthAccountRepository & {
  linked: unknown[];
} {
  const linked: unknown[] = [];

  return {
    linked,
    async findLinkedUser() {
      return null;
    },
    async linkToUser(input) {
      linked.push(input);
    }
  };
}
