import { describe, expect, test } from "bun:test";

import { parseAuthApiEnv } from "../src/config/env";
import type { PlatformUserRepository } from "../src/modules/users/platform-user-repository";
import { createLegacyPasswordHash } from "../src/modules/auth/password";
import { createMemorySessionStore } from "../src/modules/session/session-store";
import { createAuthApiServer } from "../src/server";

const env = parseAuthApiEnv({
  DATABASE_URL: "postgres://postgres:secret@localhost:5432/sga_db",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "a".repeat(32)
});

describe("auth login route", () => {
  test("logs in an active user by email and sets session cookie", async () => {
    const sessions = createMemorySessionStore();
    const users = createUsersRepository({
      id: 1,
      email: "player@santos-games.com",
      login: "player",
      passwordHash: await createLegacyPasswordHash("secret", env.JWT_SECRET),
      isActive: true
    });
    const server = createAuthApiServer({ env, sessions, users });

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        identifier: "player@santos-games.com",
        password: "secret"
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
    expect(users.lastLoginUpdatedFor).toBe(1);

    await server.close();
  });

  test("rejects invalid credentials", async () => {
    const users = createUsersRepository({
      id: 1,
      email: "player@santos-games.com",
      login: "player",
      passwordHash: await createLegacyPasswordHash("secret", env.JWT_SECRET),
      isActive: true
    });
    const server = createAuthApiServer({ env, users });

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        identifier: "player",
        password: "wrong"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "invalid_credentials",
      message: "Credenciais invalidas."
    });

    await server.close();
  });

  test("rejects inactive users", async () => {
    const users = createUsersRepository({
      id: 1,
      email: "player@santos-games.com",
      login: "player",
      passwordHash: await createLegacyPasswordHash("secret", env.JWT_SECRET),
      isActive: false
    });
    const server = createAuthApiServer({ env, users });

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        identifier: "player",
        password: "secret"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "user_inactive",
      message: "Usuario inativo."
    });

    await server.close();
  });
});

function createUsersRepository(user: Awaited<ReturnType<PlatformUserRepository["findByIdentifier"]>>) {
  return {
    lastLoginUpdatedFor: null as number | null,
    async findByIdentifier(identifier: string) {
      if (!user) {
        return null;
      }

      return identifier === user.email || identifier === user.login ? user : null;
    },
    async updateLastLogin(userId: number) {
      this.lastLoginUpdatedFor = userId;
    }
  };
}
