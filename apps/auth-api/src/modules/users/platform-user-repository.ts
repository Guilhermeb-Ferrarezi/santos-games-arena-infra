import type { PostgresClient } from "@santos-games/postgres";
import type { OAuthProvider } from "../oauth/providers";

const PLATFORM_USER_ROLE = 2;

export type PlatformUser = {
  id: number;
  email: string;
  login: string;
  passwordHash: string;
  isActive: boolean;
};

export type PlatformUserRepository = {
  findByIdentifier(identifier: string): Promise<PlatformUser | null>;
  findById(userId: number): Promise<PlatformUser | null>;
  createUser(input: {
    email: string;
    login: string;
    passwordHash: string;
  }): Promise<PlatformUser>;
  createOAuthUser(input: {
    email: string;
    login: string;
    provider: OAuthProvider;
    externalAccountId: string;
  }): Promise<PlatformUser>;
  updatePassword(userId: number, passwordHash: string): Promise<void>;
  updateLastLogin(userId: number): Promise<void>;
};

export function createPlatformUserRepository(
  client: PostgresClient
): PlatformUserRepository {
  return {
    async findByIdentifier(identifier: string) {
      const normalizedIdentifier = identifier.trim().toLowerCase();
      const [user] = await client<Array<{
        id: number;
        email: string;
        login: string;
        password_hash: string;
        is_active: boolean;
      }>>`
        select id, email, login, password_hash, is_active
        from "User"
        where lower(email) = ${normalizedIdentifier}
           or lower(login) = ${normalizedIdentifier}
        limit 1
      `;

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        login: user.login,
        passwordHash: user.password_hash,
        isActive: user.is_active
      };
    },

    async findById(userId: number) {
      const [user] = await client<Array<{
        id: number;
        email: string;
        login: string;
        password_hash: string;
        is_active: boolean;
      }>>`
        select id, email, login, password_hash, is_active
        from "User"
        where id = ${userId}
        limit 1
      `;

      return user
        ? {
            id: user.id,
            email: user.email,
            login: user.login,
            passwordHash: user.password_hash,
            isActive: user.is_active
          }
        : null;
    },

    async createUser(input) {
      const [user] = await client<Array<{
        id: number;
        email: string;
        login: string;
        password_hash: string;
        is_active: boolean;
      }>>`
        insert into "User" (
          email,
          login,
          password_hash,
          role,
          is_active,
          created_at,
          updated_at
        )
        values (
          ${input.email},
          ${input.login},
          ${input.passwordHash},
          ${PLATFORM_USER_ROLE},
          true,
          now(),
          now()
        )
        returning id, email, login, password_hash, is_active
      `;

      return {
        id: user.id,
        email: user.email,
        login: user.login,
        passwordHash: user.password_hash,
        isActive: user.is_active
      };
    },

    async createOAuthUser(input) {
      const [user] = await client<Array<{
        id: number;
        email: string;
        login: string;
        password_hash: string;
        is_active: boolean;
      }>>`
        insert into "User" (
          email,
          login,
          password_hash,
          role,
          is_active,
          created_at,
          updated_at
        )
        values (
          ${input.email},
          ${input.login},
          ${`oauth:${input.provider}:${input.externalAccountId}`},
          ${PLATFORM_USER_ROLE},
          true,
          now(),
          now()
        )
        returning id, email, login, password_hash, is_active
      `;

      return {
        id: user.id,
        email: user.email,
        login: user.login,
        passwordHash: user.password_hash,
        isActive: user.is_active
      };
    },

    async updateLastLogin(userId: number) {
      await client`
        update "User"
        set last_login_at = now(),
            updated_at = now()
        where id = ${userId}
      `;
    },

    async updatePassword(userId: number, passwordHash: string) {
      await client`
        update "User"
        set password_hash = ${passwordHash},
            updated_at = now()
        where id = ${userId}
      `;
    }
  };
}
