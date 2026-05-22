import type { PostgresClient } from "@santos-games/postgres";

export async function runMigrations(client: PostgresClient): Promise<void> {
  // Adiciona user_login e user_email se não existirem
  await client`
    ALTER TABLE checkout_customers
    ADD COLUMN IF NOT EXISTS user_login TEXT,
    ADD COLUMN IF NOT EXISTS user_email TEXT
  `;
}
