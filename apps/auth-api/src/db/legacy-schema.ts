export const legacyAuthSchema = {
  user: {
    sourceModel: "dotnet-primary-api/SGA_Plataforma.Infrastructure/Models/User-Models.cs",
    table: "User",
    columns: {
      id: "id",
      createdAt: "created_at",
      updatedAt: "updated_at",
      email: "email",
      login: "login",
      passwordHash: "password_hash",
      role: "role",
      isActive: "is_active",
      lastLoginAt: "last_login_at"
    },
    uniqueIndexes: ["email", "login"]
  },
  gameAccount: {
    sourceModel: "dotnet-primary-api/SGA_Plataforma.Infrastructure/Models/GameAccount-Models.cs",
    table: "Game_Account",
    columns: {
      id: "id",
      createdAt: "created_at",
      updatedAt: "updated_at",
      nickname: "nickname",
      tag: "tag",
      provider: "provider",
      externalAccountId: "external_account_id",
      region: "region",
      shard: "shard",
      lastVerifiedAt: "last_verified_at",
      isVerified: "is_verified",
      gameId: "game_id",
      playerId: "player_id"
    },
    uniqueIndexes: ["provider_external_account_id"]
  },
  role: {
    sourceModel: "dotnet-primary-api/SGA_Plataforma.Infrastructure/Models/Role-Models.cs",
    table: "Role",
    columns: {
      id: "id",
      createdAt: "created_at",
      updatedAt: "updated_at",
      name: "name",
      gameId: "game_id"
    },
    uniqueIndexes: []
  },
  externalAuthAccount: {
    sourceModel: "dotnet-primary-api/SGA_Plataforma.Infrastructure/Models/ExternalAuthAccount-Models.cs",
    table: "External_Auth_Account",
    columns: {
      id: "id",
      createdAt: "created_at",
      updatedAt: "updated_at",
      userId: "user_id",
      provider: "provider",
      externalAccountId: "external_account_id",
      email: "email",
      displayName: "display_name",
      avatarUrl: "avatar_url",
      lastLoginAt: "last_login_at"
    },
    uniqueIndexes: ["provider_external_account_id"]
  },
  refreshToken: {
    sourceModel: "auth-api/src/modules/session/refresh-token-repository.ts",
    table: "Refresh_Token",
    columns: {
      id: "id",
      userId: "user_id",
      tokenHash: "token_hash",
      deviceLabel: "device_label",
      ip: "ip",
      userAgent: "user_agent",
      createdAt: "created_at",
      lastUsedAt: "last_used_at",
      expiresAt: "expires_at",
      revokedAt: "revoked_at"
    },
    uniqueIndexes: ["token_hash"]
  },
  authClient: {
    sourceModel: "dotnet-primary-api/SGA_Plataforma.Infrastructure/Models/AuthClient-Models.cs",
    table: "Auth_Client",
    columns: {
      id: "id",
      createdAt: "created_at",
      updatedAt: "updated_at",
      clientId: "client_id",
      name: "name",
      allowedRedirectUris: "allowed_redirect_uris",
      isActive: "is_active"
    },
    uniqueIndexes: ["client_id"]
  }
} as const;
