import type { PostgresClient } from "@santos-games/postgres";
import type { OAuthProvider } from "../oauth/providers";

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
        from "Platform_User"
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
        from "Platform_User"
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
        insert into "Platform_User" (
          email,
          login,
          password_hash,
          is_active,
          created_at,
          updated_at
        )
        values (
          ${input.email},
          ${input.login},
          ${input.passwordHash},
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
        insert into "Platform_User" (
          email,
          login,
          password_hash,
          is_active,
          created_at,
          updated_at
        )
        values (
          ${input.email},
          ${input.login},
          ${`oauth:${input.provider}:${input.externalAccountId}`},
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
        update "Platform_User"
        set last_login_at = now(),
            updated_at = now()
        where id = ${userId}
      `;
    }
  };
}
