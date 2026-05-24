import { randomBytes } from "crypto";
import type { RedisClient } from "@santos-games/redis";

export type PayIntentStore = ReturnType<typeof createPayIntentStore>;

const INTENT_TTL_SECONDS = 1800; // 30 min

function key(token: string) {
  return `checkout:pay-intent:${token}`;
}

export function createPayIntentStore(redis: RedisClient) {
  async function create(productId: number): Promise<string> {
    const token = randomBytes(16).toString("hex");
    await redis.set(key(token), String(productId), "EX", INTENT_TTL_SECONDS);
    return token;
  }

  async function get(token: string): Promise<number | null> {
    const raw = await redis.get(key(token));
    if (!raw) return null;
    const id = parseInt(raw, 10);
    return isNaN(id) ? null : id;
  }

  return { create, get };
}
