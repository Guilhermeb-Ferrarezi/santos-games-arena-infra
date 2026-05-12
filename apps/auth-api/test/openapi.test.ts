import { describe, expect, test } from "bun:test";

import { parseAuthApiEnv } from "../src/config/env";
import { createAuthApiServer } from "../src/server";

const env = parseAuthApiEnv({
  DATABASE_URL: "postgres://postgres:secret@localhost:5432/sga_db",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "a".repeat(32)
});

describe("openapi docs", () => {
  test("serves openapi json", async () => {
    const server = createAuthApiServer({ env });
    await server.ready();

    const response = await server.inject({
      method: "GET",
      url: "/api/openapi.json"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().info.title).toBe("Santos Games Auth API");

    await server.close();
  });
});
