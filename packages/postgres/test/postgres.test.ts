import { describe, expect, test } from "bun:test";

import { createPostgresClient, pingPostgres } from "../src";

describe("createPostgresClient", () => {
  test("creates a lazy postgres client from DATABASE_URL", async () => {
    const client = createPostgresClient({
      DATABASE_URL: "postgres://postgres:secret@localhost:5432/sga_db"
    });

    expect(typeof client).toBe("function");

    await client.end({ timeout: 0 });
  });
});

describe("pingPostgres", () => {
  test("returns true when select 1 succeeds", async () => {
    const client = async () => [{ ok: 1 }];

    expect(await pingPostgres(client)).toBe(true);
  });
});
