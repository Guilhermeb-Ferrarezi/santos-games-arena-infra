import { describe, expect, test } from "bun:test";
import { createAuthApiServer } from "../src/server";

describe("createAuthApiServer", () => {
  test("exposes auth api health status", async () => {
    const server = createAuthApiServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "auth-api"
    });

    await server.close();
  });

  test("exposes dependency health when pingers are configured", async () => {
    const server = createAuthApiServer({
      dependencies: {
        postgres: async () => true,
        redis: async () => true
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/health/dependencies"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      dependencies: {
        postgres: "up",
        redis: "up"
      }
    });

    await server.close();
  });
});
