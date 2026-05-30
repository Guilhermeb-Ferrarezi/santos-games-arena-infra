import type { PostgresClient } from "@santos-games/postgres";
import type { OAuthProvider } from "../oauth/providers";

const PLATFORM_USER_ROLE = 2;
export const ADMIN_ROLE = 1;

export type PlatformUser = {
  id: number;
  email: string;
  login: string;
  passwordHash: string;
  isActive: boolean;
  role: number;
  createdAt: Date;
  avatarUrl: string | null;
  totpSecret: string | null;
  totpEnabled: boolean;
  totpBackupCodes: string[] | null;
};

export type PlatformUserRepository = {
  findByIdentifier(identifier: string): Promise<PlatformUser | null>;
  findById(userId: number): Promise<PlatformUser | null>;
  createUser(input: { email: string; login: string; passwordHash: string }): Promise<PlatformUser>;
  createOAuthUser(input: {
    email: string; login: string; provider: OAuthProvider; externalAccountId: string;
  }): Promise<PlatformUser>;
  updatePassword(userId: number, passwordHash: string): Promise<void>;
  updateLastLogin(userId: number): Promise<void>;
  updateAvatarUrl(userId: number, avatarUrl: string): Promise<void>;
  enableTotp(userId: number, secret: string, backupCodeHashes: string[]): Promise<void>;
  disableTotp(userId: number): Promise<void>;
  updateTotpBackupCodes(userId: number, remaining: string[]): Promise<void>;
  countActiveRefreshTokens(userId: number): Promise<number>;
};

type UserRow = {
  id: number;
  email: string;
  login: string;
  password_hash: string;
  is_active: boolean;
  role: number;
  created_at: Date;
  avatar_url: string | null;
  totp_secret: string | null;
  totp_enabled: boolean;
  totp_backup_codes: string | null;
};

const SELECT_FIELDS = `
  id, email, login, password_hash, is_active, role, created_at,
  avatar_url, totp_secret, totp_enabled, totp_backup_codes
`;

function mapUser(row: UserRow): PlatformUser {
  return {
    id: row.id,
    email: row.email,
    login: row.login,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    role: row.role,
    createdAt: row.created_at,
    avatarUrl: row.avatar_url,
    totpSecret: row.totp_secret,
    totpEnabled: row.totp_enabled ?? false,
    totpBackupCodes: row.totp_backup_codes ? JSON.parse(row.totp_backup_codes) : null,
  };
}

export function createPlatformUserRepository(client: PostgresClient): PlatformUserRepository {
  return {
    async findByIdentifier(identifier) {
      const norm = identifier.trim().toLowerCase();
      const [row] = await client<UserRow[]>`
        select ${client.unsafe(SELECT_FIELDS)}
        from "User"
        where lower(email) = ${norm} or lower(login) = ${norm}
        limit 1
      `;
      return row ? mapUser(row) : null;
    },

    async findById(userId) {
      const [row] = await client<UserRow[]>`
        select ${client.unsafe(SELECT_FIELDS)}
        from "User"
        where id = ${userId}
        limit 1
      `;
      return row ? mapUser(row) : null;
    },

    async createUser(input) {
      const [row] = await client<UserRow[]>`
        insert into "User" (email, login, password_hash, role, is_active, created_at, updated_at)
        values (${input.email}, ${input.login}, ${input.passwordHash}, ${PLATFORM_USER_ROLE}, true, now(), now())
        returning ${client.unsafe(SELECT_FIELDS)}
      `;
      return mapUser(row);
    },

    async createOAuthUser(input) {
      const [row] = await client<UserRow[]>`
        insert into "User" (email, login, password_hash, role, is_active, created_at, updated_at)
        values (
          ${input.email}, ${input.login},
          ${"oauth:" + input.provider + ":" + input.externalAccountId},
          ${PLATFORM_USER_ROLE}, true, now(), now()
        )
        returning ${client.unsafe(SELECT_FIELDS)}
      `;
      return mapUser(row);
    },

    async updateLastLogin(userId) {
      await client`update "User" set last_login_at = now(), updated_at = now() where id = ${userId}`;
    },

    async updatePassword(userId, passwordHash) {
      await client`update "User" set password_hash = ${passwordHash}, updated_at = now() where id = ${userId}`;
    },

    async updateAvatarUrl(userId, avatarUrl) {
      await client`update "User" set avatar_url = ${avatarUrl}, updated_at = now() where id = ${userId}`;
    },

    async enableTotp(userId, secret, backupCodeHashes) {
      await client`
        update "User"
        set totp_secret = ${secret},
            totp_enabled = true,
            totp_backup_codes = ${JSON.stringify(backupCodeHashes)},
            updated_at = now()
        where id = ${userId}
      `;
    },

    async disableTotp(userId) {
      await client`
        update "User"
        set totp_secret = null,
            totp_enabled = false,
            totp_backup_codes = null,
            updated_at = now()
        where id = ${userId}
      `;
    },

    async updateTotpBackupCodes(userId, remaining) {
      await client`
        update "User"
        set totp_backup_codes = ${JSON.stringify(remaining)},
            updated_at = now()
        where id = ${userId}
      `;
    },

    async countActiveRefreshTokens(userId) {
      const [row] = await client<[{ count: string }]>`
        select count(*) as count from "Refresh_Token"
        where user_id = ${userId} and revoked_at is null and expires_at > now()
      `;
      return parseInt(row?.count ?? "0", 10);
    },
  };
}
