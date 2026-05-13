# Auth API Completeness

Current estimate: 97%.

## Done

- Monorepo workspace with Bun.
- `auth-api` Fastify application.
- Environment validation.
- Shared Redis package.
- Shared Postgres package.
- Healthcheck endpoints.
- Dependency healthcheck for Postgres and Redis.
- Legacy .NET schema reference for auth tables.
- Session JWT creation and verification.
- `GET /api/auth/session`.
- `POST /api/auth/logout`.
- `POST /api/auth/login` against `Platform_User`.
- Password verification for bcrypt hashes and internal `sha256:` legacy/test hashes.
- Cookie-based session.
- Redis-backed session storage.
- Logout revokes stored sessions.
- OAuth start redirects for Google, Discord and Steam.
- OAuth callbacks for Google and Discord token exchange/profile lookup.
- Steam callback scaffolding and Steam ID session creation path.
- External account linking through `External_Auth_Account`.
- EF Core migration for `External_Auth_Account` in the .NET project.
- `External_Auth_Account` migration applied to the configured database with `dotnet ef database update`.
- OpenAPI JSON and Swagger UI.
- Dockerfile for `auth-api`.
- Root `docker-compose.yml` with sga-auth-api, Postgres and Redis.
- Unit tests for env, health, dependencies, session, session storage, login, OAuth start, OpenAPI and shared Postgres.

## Not Done

- Full live OAuth validation with real Google, Discord and Steam applications.
- Steam OpenID callback hardening against Steam's `check_authentication` response.
- Refresh-token rotation if the platform needs long-lived sessions beyond the current Redis-backed session cookie.
- Production seed/admin flow.
- Integration test against a migrated real database.
- Production deployment validation behind the final proxy/domain.

## Important Constraint

Database migrations are owned by `dotnet-primary-api`. The Bun `auth-api` consumes the existing schema and must not generate or run migrations.
