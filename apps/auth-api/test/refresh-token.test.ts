import { describe, expect, test } from "bun:test";

import { generateRefreshToken, hashRefreshToken } from "../src/modules/session/refresh-token";
import { createMemoryRefreshTokenRepository } from "../src/modules/session/refresh-token-repository";

describe("refresh-token utils", () => {
  test("generateRefreshToken returns 64-char hex string", () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  test("hashRefreshToken is deterministic SHA-256 hex", () => {
    const hash1 = hashRefreshToken("foo");
    const hash2 = hashRefreshToken("foo");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  test("different tokens produce different hashes", () => {
    expect(hashRefreshToken("a")).not.toBe(hashRefreshToken("b"));
  });
});

describe("refresh-token repository (memory)", () => {
  function futureDate(days = 30) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  test("creates and finds by hash", async () => {
    const repo = createMemoryRefreshTokenRepository();
    const created = await repo.create({
      userId: 1,
      tokenHash: "hash1",
      expiresAt: futureDate(),
    });
    expect(created.userId).toBe(1);
    expect(created.revokedAt).toBeNull();

    const found = await repo.findByHash("hash1");
    expect(found?.userId).toBe(1);
  });

  test("returns null for unknown hash", async () => {
    const repo = createMemoryRefreshTokenRepository();
    expect(await repo.findByHash("nope")).toBeNull();
  });

  test("returns null for expired token", async () => {
    const repo = createMemoryRefreshTokenRepository();
    await repo.create({
      userId: 1,
      tokenHash: "expired",
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await repo.findByHash("expired")).toBeNull();
  });

  test("returns null for revoked token", async () => {
    const repo = createMemoryRefreshTokenRepository();
    const created = await repo.create({
      userId: 1,
      tokenHash: "revoked",
      expiresAt: futureDate(),
    });
    await repo.revoke(created.id, 1);
    expect(await repo.findByHash("revoked")).toBeNull();
  });

  test("rotate revokes old and creates new", async () => {
    const repo = createMemoryRefreshTokenRepository();
    await repo.create({ userId: 1, tokenHash: "old", expiresAt: futureDate() });

    const rotated = await repo.rotate("old", {
      userId: 1,
      newTokenHash: "new",
      expiresAt: futureDate(),
    });

    expect(rotated.tokenHash).toBe("new");
    expect(await repo.findByHash("old")).toBeNull();
    expect((await repo.findByHash("new"))?.userId).toBe(1);
  });

  test("revokeAll revokes all tokens of the user", async () => {
    const repo = createMemoryRefreshTokenRepository();
    await repo.create({ userId: 1, tokenHash: "a", expiresAt: futureDate() });
    await repo.create({ userId: 1, tokenHash: "b", expiresAt: futureDate() });
    await repo.create({ userId: 2, tokenHash: "c", expiresAt: futureDate() });

    const count = await repo.revokeAll(1);
    expect(count).toBe(2);
    expect(await repo.findByHash("a")).toBeNull();
    expect(await repo.findByHash("b")).toBeNull();
    expect((await repo.findByHash("c"))?.userId).toBe(2);
  });

  test("revokeOthers keeps the current token", async () => {
    const repo = createMemoryRefreshTokenRepository();
    await repo.create({ userId: 1, tokenHash: "current", expiresAt: futureDate() });
    await repo.create({ userId: 1, tokenHash: "other1", expiresAt: futureDate() });
    await repo.create({ userId: 1, tokenHash: "other2", expiresAt: futureDate() });

    const count = await repo.revokeOthers(1, "current");
    expect(count).toBe(2);
    expect((await repo.findByHash("current"))?.userId).toBe(1);
    expect(await repo.findByHash("other1")).toBeNull();
    expect(await repo.findByHash("other2")).toBeNull();
  });

  test("listByUser returns only active tokens", async () => {
    const repo = createMemoryRefreshTokenRepository();
    await repo.create({ userId: 1, tokenHash: "a", expiresAt: futureDate(), deviceLabel: "browser" });
    const b = await repo.create({ userId: 1, tokenHash: "b", expiresAt: futureDate() });
    await repo.revoke(b.id, 1);

    const list = await repo.listByUser(1);
    expect(list).toHaveLength(1);
    expect(list[0].tokenHash).toBe("a");
  });
});
