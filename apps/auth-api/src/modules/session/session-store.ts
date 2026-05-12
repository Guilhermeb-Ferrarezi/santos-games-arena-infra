import type { RedisClient } from "@santos-games/redis";

export type SessionRecord = {
  sessionId: string;
  userId: number;
  ttlSeconds: number;
};

export type SessionStore = {
  create(record: SessionRecord): Promise<void>;
  exists(sessionId: string): Promise<boolean>;
  revoke(sessionId: string): Promise<void>;
};

export function createSessionId() {
  return crypto.randomUUID();
}

export function createMemorySessionStore(): SessionStore {
  const sessions = new Map<string, number>();

  return {
    async create(record) {
      sessions.set(record.sessionId, Date.now() + record.ttlSeconds * 1000);
    },

    async exists(sessionId) {
      const expiresAt = sessions.get(sessionId);

      if (!expiresAt) {
        return false;
      }

      if (expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return false;
      }

      return true;
    },

    async revoke(sessionId) {
      sessions.delete(sessionId);
    }
  };
}

export function createRedisSessionStore(redis: RedisClient): SessionStore {
  return {
    async create(record) {
      await redis.set(sessionKey(record.sessionId), String(record.userId), "EX", record.ttlSeconds);
    },

    async exists(sessionId) {
      return (await redis.exists(sessionKey(sessionId))) === 1;
    },

    async revoke(sessionId) {
      await redis.del(sessionKey(sessionId));
    }
  };
}

function sessionKey(sessionId: string) {
  return `auth:session:${sessionId}`;
}
