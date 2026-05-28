-- Tabela de refresh tokens para gestão de sessões
-- Rodar uma vez no PostgreSQL do sga-auth-api

CREATE TABLE IF NOT EXISTS "Refresh_Token" (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  device_label TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_user_active
  ON "Refresh_Token"(user_id, revoked_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_expires
  ON "Refresh_Token"(expires_at)
  WHERE revoked_at IS NULL;
