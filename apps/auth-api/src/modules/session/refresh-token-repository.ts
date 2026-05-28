import type { PostgresClient } from "@santos-games/postgres";
import type { RedisClient } from "@santos-games/redis";

export type RefreshTokenRecord = {
  id: number;
  userId: number;
  tokenHash: string;
  deviceLabel: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type RefreshTokenLookup = {
  id: number;
  userId: number;
  expiresAt: number;
};

export type RefreshTokenRepository = {
  create(input: {
    userId: number;
    tokenHash: string;
    deviceLabel?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenLookup | null>;
  listByUser(userId: number): Promise<RefreshTokenRecord[]>;
  touch(id: number): Promise<void>;
  rotate(oldHash: string, input: {
    userId: number;
    newTokenHash: string;
    deviceLabel?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord>;
  revoke(id: number, userId: number): Promise<void>;
  revokeAll(userId: number): Promise<number>;
  revokeOthers(userId: number, exceptHash: string): Promise<number>;
  revokeByHash(tokenHash: string): Promise<void>;
};

type Row = {
  id: number;
  user_id: number;
  token_hash: string;
  device_label: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date;
  revoked_at: Date | null;
};

function toRecord(row: Row): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    deviceLabel: row.device_label,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

const REDIS_KEY_PREFIX = "auth:refresh:";
const REDIS_USER_SET_PREFIX = "auth:refresh:user:";

function redisKey(tokenHash: string) {
  return `${REDIS_KEY_PREFIX}${tokenHash}`;
}

function redisUserSetKey(userId: number) {
  return `${REDIS_USER_SET_PREFIX}${userId}`;
}

function ttlSeconds(expiresAt: Date) {
  return Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
}

export function createRefreshTokenRepository(
  postgres: PostgresClient,
  redis?: RedisClient,
): RefreshTokenRepository {
  async function cacheSet(record: RefreshTokenRecord) {
    if (!redis) return;
    const ttl = ttlSeconds(record.expiresAt);
    const payload: RefreshTokenLookup = {
      id: record.id,
      userId: record.userId,
      expiresAt: Math.floor(record.expiresAt.getTime() / 1000),
    };
    await redis.set(redisKey(record.tokenHash), JSON.stringify(payload), "EX", ttl);
    await redis.sadd(redisUserSetKey(record.userId), record.tokenHash);
    await redis.expire(redisUserSetKey(record.userId), ttl);
  }

  async function cacheDel(tokenHash: string, userId: number) {
    if (!redis) return;
    await redis.del(redisKey(tokenHash));
    await redis.srem(redisUserSetKey(userId), tokenHash);
  }

  async function cacheClearUser(userId: number) {
    if (!redis) return;
    const setKey = redisUserSetKey(userId);
    const hashes = await redis.smembers(setKey);
    if (hashes.length > 0) {
      await redis.del(...hashes.map(redisKey));
    }
    await redis.del(setKey);
  }

  return {
    async create(input) {
      const [row] = await postgres<Row[]>`
        insert into "Refresh_Token" (
          user_id, token_hash, device_label, ip, user_agent,
          created_at, last_used_at, expires_at, revoked_at
        )
        values (
          ${input.userId}, ${input.tokenHash}, ${input.deviceLabel ?? null},
          ${input.ip ?? null}, ${input.userAgent ?? null},
          now(), null, ${input.expiresAt}, null
        )
        returning id, user_id, token_hash, device_label, ip, user_agent,
                  created_at, last_used_at, expires_at, revoked_at
      `;
      const record = toRecord(row);
      await cacheSet(record);
      return record;
    },

    async findByHash(tokenHash) {
      if (redis) {
        const cached = await redis.get(redisKey(tokenHash));
        if (cached) {
          return JSON.parse(cached) as RefreshTokenLookup;
        }
      }
      const [row] = await postgres<Row[]>`
        select id, user_id, token_hash, device_label, ip, user_agent,
               created_at, last_used_at, expires_at, revoked_at
        from "Refresh_Token"
        where token_hash = ${tokenHash}
          and revoked_at is null
          and expires_at > now()
        limit 1
      `;
      if (!row) return null;
      const record = toRecord(row);
      await cacheSet(record);
      return {
        id: record.id,
        userId: record.userId,
        expiresAt: Math.floor(record.expiresAt.getTime() / 1000),
      };
    },

    async listByUser(userId) {
      const rows = await postgres<Row[]>`
        select id, user_id, token_hash, device_label, ip, user_agent,
               created_at, last_used_at, expires_at, revoked_at
        from "Refresh_Token"
        where user_id = ${userId}
          and revoked_at is null
          and expires_at > now()
        order by last_used_at desc nulls last, created_at desc
      `;
      return rows.map(toRecord);
    },

    async touch(id) {
      await postgres`
        update "Refresh_Token" set last_used_at = now() where id = ${id}
      `;
    },

    async rotate(oldHash, input) {
      const [oldRow] = await postgres<Row[]>`
        update "Refresh_Token"
        set revoked_at = now()
        where token_hash = ${oldHash} and revoked_at is null
        returning user_id
      `;
      if (oldRow) {
        await cacheDel(oldHash, oldRow.user_id);
      }
      const [row] = await postgres<Row[]>`
        insert into "Refresh_Token" (
          user_id, token_hash, device_label, ip, user_agent,
          created_at, last_used_at, expires_at, revoked_at
        )
        values (
          ${input.userId}, ${input.newTokenHash}, ${input.deviceLabel ?? null},
          ${input.ip ?? null}, ${input.userAgent ?? null},
          now(), now(), ${input.expiresAt}, null
        )
        returning id, user_id, token_hash, device_label, ip, user_agent,
                  created_at, last_used_at, expires_at, revoked_at
      `;
      const record = toRecord(row);
      await cacheSet(record);
      return record;
    },

    async revoke(id, userId) {
      const [row] = await postgres<{ token_hash: string }[]>`
        update "Refresh_Token"
        set revoked_at = now()
        where id = ${id} and user_id = ${userId} and revoked_at is null
        returning token_hash
      `;
      if (row) {
        await cacheDel(row.token_hash, userId);
      }
    },

    async revokeByHash(tokenHash) {
      const [row] = await postgres<{ user_id: number }[]>`
        update "Refresh_Token"
        set revoked_at = now()
        where token_hash = ${tokenHash} and revoked_at is null
        returning user_id
      `;
      if (row) {
        await cacheDel(tokenHash, row.user_id);
      }
    },

    async revokeAll(userId) {
      const result = await postgres`
        update "Refresh_Token"
        set revoked_at = now()
        where user_id = ${userId} and revoked_at is null
      `;
      await cacheClearUser(userId);
      return result.count;
    },

    async revokeOthers(userId, exceptHash) {
      const result = await postgres`
        update "Refresh_Token"
        set revoked_at = now()
        where user_id = ${userId}
          and token_hash <> ${exceptHash}
          and revoked_at is null
      `;
      if (redis) {
        const setKey = redisUserSetKey(userId);
        const hashes = await redis.smembers(setKey);
        const toDelete = hashes.filter((h) => h !== exceptHash);
        if (toDelete.length > 0) {
          await redis.del(...toDelete.map(redisKey));
          await redis.srem(setKey, ...toDelete);
        }
      }
      return result.count;
    },
  };
}

export function createMemoryRefreshTokenRepository(): RefreshTokenRepository {
  const records = new Map<number, RefreshTokenRecord>();
  let nextId = 1;

  return {
    async create(input) {
      const record: RefreshTokenRecord = {
        id: nextId++,
        userId: input.userId,
        tokenHash: input.tokenHash,
        deviceLabel: input.deviceLabel ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        createdAt: new Date(),
        lastUsedAt: null,
        expiresAt: input.expiresAt,
        revokedAt: null,
      };
      records.set(record.id, record);
      return record;
    },
    async findByHash(tokenHash) {
      for (const r of records.values()) {
        if (r.tokenHash === tokenHash && !r.revokedAt && r.expiresAt > new Date()) {
          return { id: r.id, userId: r.userId, expiresAt: Math.floor(r.expiresAt.getTime() / 1000) };
        }
      }
      return null;
    },
    async listByUser(userId) {
      return [...records.values()].filter(
        (r) => r.userId === userId && !r.revokedAt && r.expiresAt > new Date(),
      );
    },
    async touch(id) {
      const r = records.get(id);
      if (r) r.lastUsedAt = new Date();
    },
    async rotate(oldHash, input) {
      for (const r of records.values()) {
        if (r.tokenHash === oldHash) r.revokedAt = new Date();
      }
      const record: RefreshTokenRecord = {
        id: nextId++,
        userId: input.userId,
        tokenHash: input.newTokenHash,
        deviceLabel: input.deviceLabel ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt: input.expiresAt,
        revokedAt: null,
      };
      records.set(record.id, record);
      return record;
    },
    async revoke(id, userId) {
      const r = records.get(id);
      if (r && r.userId === userId) r.revokedAt = new Date();
    },
    async revokeByHash(tokenHash) {
      for (const r of records.values()) {
        if (r.tokenHash === tokenHash && !r.revokedAt) r.revokedAt = new Date();
      }
    },
    async revokeAll(userId) {
      let count = 0;
      for (const r of records.values()) {
        if (r.userId === userId && !r.revokedAt) {
          r.revokedAt = new Date();
          count++;
        }
      }
      return count;
    },
    async revokeOthers(userId, exceptHash) {
      let count = 0;
      for (const r of records.values()) {
        if (r.userId === userId && r.tokenHash !== exceptHash && !r.revokedAt) {
          r.revokedAt = new Date();
          count++;
        }
      }
      return count;
    },
  };
}
