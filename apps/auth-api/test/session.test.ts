import { describe, expect, test } from "bun:test";

import { parseAuthApiEnv } from "../src/config/env";
import { createSessionToken } from "../src/modules/session/session-token";
import { createMemorySessionStore } from "../src/modules/session/session-store";
import { createAuthApiServer } from "../src/server";

const env = parseAuthApiEnv({
  DATABASE_URL: "postgres://postgres:secret@localhost:5432/sga_db",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "a".repeat(32)
});

describe("auth session routes", () => {
  test("returns anonymous session without auth cookie", async () => {
    const server = createAuthApiServer({ env });

    const response = await server.inject({
      method: "GET",
      url: "/api/auth/session"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      authenticated: false,
      user: null
    });

    await server.close();
  });

  test("returns session user when auth cookie is valid", async () => {
    const server = createAuthApiServer({ env });
    const token = await createSessionToken(
      {
        userId: 10,
        email: "player@santos-games.com",
        login: "player"
      },
      env
    );

    const response = await server.inject({
      method: "GET",
      url: "/api/auth/session",
      cookies: {
        sg_auth: token
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      authenticated: true,
      user: {
        id: 10,
        email: "player@santos-games.com",
        login: "player"
      }
    });

    await server.close();
  });

  test("logout clears auth cookie", async () => {
    const server = createAuthApiServer({ env });

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/logout"
    });

    const setCookie = Array.isArray(response.headers["set-cookie"])
      ? response.headers["set-cookie"].join("; ")
      : response.headers["set-cookie"];

    expect(response.statusCode).toBe(204);
    expect(setCookie).toContain("sg_auth=");
    expect(setCookie).toContain("Max-Age=0");

    await server.close();
  });

  test("logout revokes stored session", async () => {
    const sessions = createMemorySessionStore();
    const server = createAuthApiServer({ env, sessions });

    await sessions.create({
      sessionId: "session-1",
      userId: 10,
      ttlSeconds: 60
    });

    const token = await createSessionToken(
      {
        userId: 10,
        email: "player@santos-games.com",
        login: "player",
        sessionId: "session-1"
      },
      env
    );

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: {
        sg_auth: token
      }
    });

    expect(response.statusCode).toBe(204);
    expect(await sessions.exists("session-1")).toBe(false);

    await server.close();
  });
});
