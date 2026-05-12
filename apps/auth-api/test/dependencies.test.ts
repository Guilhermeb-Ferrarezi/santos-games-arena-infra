import { describe, expect, test } from "bun:test";

import { checkDependencies } from "../src/infra/dependencies";

describe("checkDependencies", () => {
  test("reports postgres and redis as up when both pings succeed", async () => {
    const result = await checkDependencies({
      postgres: async () => true,
      redis: async () => true
    });

    expect(result).toEqual({
      status: "ok",
      dependencies: {
        postgres: "up",
        redis: "up"
      }
    });
  });

  test("reports degraded when one dependency ping fails", async () => {
    const result = await checkDependencies({
      postgres: async () => true,
      redis: async () => {
        throw new Error("redis unavailable");
      }
    });

    expect(result).toEqual({
      status: "degraded",
      dependencies: {
        postgres: "up",
        redis: "down"
      }
    });
  });
});
