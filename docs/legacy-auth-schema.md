# Legacy Auth Schema Reference

Este documento registra as tabelas da API .NET que a nova `auth-api` deve considerar ao ler ou escrever dados de autenticação.

As migrations continuam pertencendo ao projeto `dotnet-primary-api`. A `auth-api` em Bun/TypeScript nao deve gerar nem executar migrations para estas tabelas.

## Fonte

- `dotnet-primary-api/SGA_Plataforma.Infrastructure/Data/AppDbContext.cs`
- `dotnet-primary-api/SGA_Plataforma.Infrastructure/Models/User-Models.cs`
- `dotnet-primary-api/SGA_Plataforma.Infrastructure/Models/GameAccount-Models.cs`
- `dotnet-primary-api/SGA_Plataforma.Infrastructure/Models/Role-Models.cs`
- `dotnet-primary-api/SGA_Plataforma.Infrastructure/Models/ExternalAuthAccount-Models.cs`
- `dotnet-primary-api/SGA_Plataforma.Infrastructure/Data/Migrations/20260512040205_initialDB.cs`
- `dotnet-primary-api/SGA_Plataforma.Infrastructure/Data/Migrations/20260512200600_AddExternalAuthAccount.cs`

## Tabelas Relevantes

### `User`

Modelo .NET: `User`

Colunas principais:

- `id`
- `created_at`
- `updated_at`
- `email`
- `login`
- `password_hash`
- `role`
- `is_active`
- `last_login_at`

Indices importantes:

- `email` unico
- `login` unico

### `Game_Account`

Modelo .NET: `GameAccount`

Colunas principais:

- `id`
- `created_at`
- `updated_at`
- `nickname`
- `tag`
- `provider`
- `external_account_id`
- `region`
- `shard`
- `last_verified_at`
- `is_verified`
- `game_id`
- `player_id`

Indices importantes:

- `provider` + `external_account_id` unico

### `Role`

Modelo .NET: `Role`

Colunas principais:

- `id`
- `created_at`
- `updated_at`
- `name`
- `game_id`

### `External_Auth_Account`

Modelo .NET: `ExternalAuthAccount`

Colunas principais:

- `id`
- `created_at`
- `updated_at`
- `user_id`
- `provider`
- `external_account_id`
- `email`
- `display_name`
- `avatar_url`
- `last_login_at`

Indices importantes:

- `provider` + `external_account_id` unico
- `user_id`

## Uso na Auth API

O arquivo `apps/auth-api/src/db/legacy-schema.ts` espelha estes nomes para evitar strings soltas no codigo da nova API.

Mudancas estruturais nestas tabelas devem ser feitas primeiro no projeto .NET, por migration, e depois refletidas no mapa TypeScript.
