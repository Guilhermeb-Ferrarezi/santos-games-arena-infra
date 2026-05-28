import { describe, expect, test } from "bun:test";

import { parseAuthApiEnv } from "../src/config/env";
import { generateRefreshToken, hashRefreshToken } from "../src/modules/session/refresh-token";
import { createMemoryRefreshTokenRepository } from "../src/modules/session/refresh-token-repository";
import { REFRESH_COOKIE_NAME } from "../src/modules/session/issue-tokens";
import { createMemorySessionStore } from "../src/modules/session/session-store";
import { createAuthApiServer } from "../src/server";

const env = parseAuthApiEnv({
  DATABASE_URL: "postgres://postgres:secret@localhost:5432/sga_db",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "a".repeat(32),
});

function userRepo() {
  const u = {
    id: 1,
    email: "a@a.com",
    login: "alice",
    passwordHash: "x",
    isActive: true,
    role: 1,
  };
  return {
    async findByIdentifier() {
      return u;
    },
    async findById() {
      return u;
    },
    async createUser() {
      return u;
    },
    async createOAuthUser() {
      return u;
    },
    async updatePassword() {},
    async updateLastLogin() {},
  };
}

describe("auth refresh endpoint", () => {
  test("returns 401 when no refresh cookie", async () => {
    const refreshTokens = createMemoryRefreshTokenRepository();
    const server = createAuthApiServer({
      env,
      sessions: createMemorySessionStore(),
      users: userRepo() as never,
      refreshTokens,
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/refresh",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("no_refresh_token");
    await server.close();
  });

  test("returns 401 for unknown refresh token", async () => {
    const refreshTokens = createMemoryRefreshTokenRepository();
    const server = createAuthApiServer({
      env,
      sessions: createMemorySessionStore(),
      users: userRepo() as never,
      refreshTokens,
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { [REFRESH_COOKIE_NAME]: "deadbeef" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("invalid_refresh_token");
    await server.close();
  });

  test("rotates refresh token and issues new access token", async () => {
    const refreshTokens = createMemoryRefreshTokenRepository();
    const plaintext = generateRefreshToken();
    const hash = hashRefreshToken(plaintext);
    await refreshTokens.create({
      userId: 1,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });

    const server = createAuthApiServer({
      env,
      sessions: createMemorySessionStore(),
      users: userRepo() as never,
      refreshTokens,
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { [REFRESH_COOKIE_NAME]: plaintext },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().authenticated).toBe(true);

    const setCookies = Array.isArray(response.headers["set-cookie"])
      ? response.headers["set-cookie"].join(";")
      : (response.headers["set-cookie"] ?? "");
    expect(setCookies).toContain(env.AUTH_COOKIE_NAME);
    expect(setCookies).toContain(REFRESH_COOKIE_NAME);

    // Old token must be revoked
    expect(await refreshTokens.findByHash(hash)).toBeNull();
    await server.close();
  });

  test("revoke-all invalidates all sessions", async () => {
    const refreshTokens = createMemoryRefreshTokenRepository();
    const plaintext = generateRefreshToken();
    const hash = hashRefreshToken(plaintext);
    await refreshTokens.create({
      userId: 1,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });
    await refreshTokens.create({
      userId: 1,
      tokenHash: "other",
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });

    const sessions = createMemorySessionStore();
    const { createSessionToken } = await import("../src/modules/session/session-token");
    const accessToken = await createSessionToken(
      { userId: 1, email: "a@a.com", login: "alice", role: 1, sessionId: "s1" },
      env,
    );

    const server = createAuthApiServer({
      env,
      sessions,
      users: userRepo() as never,
      refreshTokens,
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/sessions/revoke-all",
      cookies: { [env.AUTH_COOKIE_NAME]: accessToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().revoked).toBe(2);
    expect(await refreshTokens.findByHash(hash)).toBeNull();
    expect(await refreshTokens.findByHash("other")).toBeNull();
    await server.close();
  });
});
