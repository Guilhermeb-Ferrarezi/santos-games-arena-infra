import { describe, expect, test } from "bun:test";

import { createHttpLogUserResolver } from "../src/modules/logs/http-log-user-resolver";
import { createPasswordHash } from "../src/modules/auth/password";
import { parseAuthApiEnv } from "../src/config/env";
import { createSessionToken } from "../src/modules/session/session-token";
import type { PlatformUserRepository } from "../src/modules/users/platform-user-repository";
import type { SessionStore } from "../src/modules/session/session-store";

const env = parseAuthApiEnv({
  DATABASE_URL: "postgres://postgres:secret@localhost:5432/sga_db",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "a".repeat(32),
  AUTH_COOKIE_NAME: "sg_auth",
  AUTH_PUBLIC_URL: "https://auth.santos-games.com"
});

describe("http log user resolver", () => {
  test("resolves authenticated user from session cookie", async () => {
    const users = createUsersRepository();
    const user = await users.createUser({
      email: "player@santos-games.com",
      login: "player",
      passwordHash: await createPasswordHash("secret123")
    });
    const sessions = createSessionStore();
    const sessionId = crypto.randomUUID();
    const resolver = createHttpLogUserResolver(
      env,
      users,
      sessions
    );

    await sessions.create({
      sessionId,
      userId: user.id,
      ttlSeconds: 3600
    });

    const sessionToken = await createSessionToken(
      {
        userId: user.id,
        email: user.email,
        login: user.login,
        sessionId
      },
      env
    );

    const result = await resolver({
      method: "GET",
      url: "/api/auth/session",
      headers: {
        cookie: `sg_auth=${encodeURIComponent(sessionToken)}`
      }
    });

    expect(result).toEqual({
      id: user.id,
      name: "player",
      email: "player@santos-games.com",
      role: "platform_user"
    });
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

function createSessionStore(): SessionStore {
  const sessions = new Set<string>();

  return {
    async create(record) {
      sessions.add(record.sessionId);
    },
    async exists(sessionId) {
      return sessions.has(sessionId);
    },
    async revoke(sessionId) {
      sessions.delete(sessionId);
    }
  };
}
