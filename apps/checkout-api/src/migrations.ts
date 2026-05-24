import type { PostgresClient } from "@santos-games/postgres";

export async function runMigrations(client: PostgresClient): Promise<void> {
  await client`
    ALTER TABLE checkout_customers
    ADD COLUMN IF NOT EXISTS user_login TEXT,
    ADD COLUMN IF NOT EXISTS user_email TEXT
  `;

  await client`
    ALTER TABLE checkout_customers
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS tax_id TEXT,
    ADD COLUMN IF NOT EXISTS cellphone TEXT
  `;

}
