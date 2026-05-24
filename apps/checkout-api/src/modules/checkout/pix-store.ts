import type { RedisClient } from "@santos-games/redis";

export type PixData = {
  brCode: string;
  brCodeBase64: string;
  expiresAt: string;
};

export type PixStore = ReturnType<typeof createPixStore>;

const PIX_TTL_SECONDS = 3600;

function key(orderId: number) {
  return `checkout:pix:${orderId}`;
}

export function createPixStore(redis: RedisClient) {
  async function save(orderId: number, data: PixData): Promise<void> {
    const ttl = Math.max(
      60,
      Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000)
    ) || PIX_TTL_SECONDS;

    await redis.set(key(orderId), JSON.stringify(data), "EX", ttl);
  }

  async function get(orderId: number): Promise<PixData | null> {
    const raw = await redis.get(key(orderId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PixData;
    } catch {
      return null;
    }
  }

  async function remove(orderId: number): Promise<void> {
    await redis.del(key(orderId));
  }

  return { save, get, remove };
}
