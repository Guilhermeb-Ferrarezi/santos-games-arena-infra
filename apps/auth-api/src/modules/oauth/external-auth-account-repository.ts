import type { PostgresClient } from "@santos-games/postgres";

import type { OAuthProfile, OAuthProvider } from "./oauth-client";
import type { PlatformUser } from "../users/platform-user-repository";

export type ExternalAuthAccountRepository = {
  findLinkedUser(provider: OAuthProvider, externalAccountId: string): Promise<PlatformUser | null>;
  linkToUser(input: OAuthProfile & { userId: number }): Promise<void>;
};

export function createExternalAuthAccountRepository(
  client: PostgresClient
): ExternalAuthAccountRepository {
  return {
    async findLinkedUser(provider, externalAccountId) {
      const [user] = await client<Array<{
        id: number;
        email: string;
        login: string;
        password_hash: string;
        is_active: boolean;
      }>>`
        select u.id, u.email, u.login, u.password_hash, u.is_active
        from "External_Auth_Account" e
        join "Platform_User" u on u.id = e.user_id
        where e.provider = ${provider}
          and e.external_account_id = ${externalAccountId}
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

    async linkToUser(input) {
      await client`
        insert into "External_Auth_Account" (
          user_id,
          provider,
          external_account_id,
          email,
          display_name,
          avatar_url,
          created_at,
          updated_at
        )
        values (
          ${input.userId},
          ${input.provider},
          ${input.externalAccountId},
          ${input.email},
          ${input.displayName ?? null},
          ${input.avatarUrl ?? null},
          now(),
          now()
        )
        on conflict (provider, external_account_id)
        do update set
          user_id = excluded.user_id,
          email = excluded.email,
          display_name = excluded.display_name,
          avatar_url = excluded.avatar_url,
          updated_at = now()
      `;
    }
  };
}
