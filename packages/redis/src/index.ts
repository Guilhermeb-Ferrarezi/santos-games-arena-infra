import Redis from "ioredis";

export type RedisClient = Redis;

export type RedisConfig = {
  REDIS_URL: string;
};

export function createRedisClient(config: RedisConfig) {
  return new Redis(config.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2
  });
}

export async function pingRedis(client: RedisClient): Promise<boolean> {
  if (client.status === "wait") {
    await client.connect();
  }

  return (await client.ping()) === "PONG";
}
