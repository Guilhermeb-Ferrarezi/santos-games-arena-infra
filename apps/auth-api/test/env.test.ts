import { describe, expect, test } from "bun:test";
import { parseAuthApiEnv } from "../src/config/env";

describe("parseAuthApiEnv", () => {
  test("normalizes required database and redis settings", () => {
    const env = parseAuthApiEnv({
      DATABASE_URL: "postgres://postgres:secret@localhost:5432/sga_db",
      REDIS_URL: "redis://localhost:6379",
      AUTH_COOKIE_DOMAIN: ".santos-games.com",
      JWT_SECRET: "a".repeat(32),
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      DISCORD_CLIENT_ID: "discord-client",
      DISCORD_CLIENT_SECRET: "discord-secret",
      STEAM_API_KEY: "steam-key"
    });

    expect(env.PORT).toBe(3001);
    expect(env.AUTH_COOKIE_NAME).toBe("sg_auth");
    expect(env.AUTH_COOKIE_DOMAIN).toBe(".santos-games.com");
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
  });

  test("rejects short jwt secrets", () => {
    expect(() =>
      parseAuthApiEnv({
        DATABASE_URL: "postgres://postgres:secret@localhost:5432/sga_db",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "short"
      })
    ).toThrow();
  });
});
