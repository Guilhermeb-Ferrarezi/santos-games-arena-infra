import { describe, expect, test } from "bun:test";

import { createMemorySessionStore } from "../src/modules/session/session-store";

describe("session store", () => {
  test("creates, reads and revokes sessions", async () => {
    const store = createMemorySessionStore();

    await store.create({
      sessionId: "session-1",
      userId: 10,
      ttlSeconds: 60
    });

    expect(await store.exists("session-1")).toBe(true);

    await store.revoke("session-1");

    expect(await store.exists("session-1")).toBe(false);
  });
});
