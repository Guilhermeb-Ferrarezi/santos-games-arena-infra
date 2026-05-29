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

  await client`
    ALTER TABLE checkout_orders
    ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pix'
  `;

  await client`
    ALTER TABLE checkout_products
    ADD COLUMN IF NOT EXISTS image_key TEXT,
    ADD COLUMN IF NOT EXISTS image_url TEXT
  `;

  await client`
    ALTER TABLE checkout_products
    ADD COLUMN IF NOT EXISTS discount_percent INTEGER
  `;

  await client`
    ALTER TABLE checkout_orders
    ADD COLUMN IF NOT EXISTS original_amount_cents INTEGER,
    ADD COLUMN IF NOT EXISTS coupon_code TEXT,
    ADD COLUMN IF NOT EXISTS discount_cents INTEGER
  `;

  await client`
    CREATE TABLE IF NOT EXISTS checkout_coupons (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      discount_percent INTEGER NOT NULL,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await client`
    ALTER TABLE checkout_orders
    RENAME COLUMN abacate_billing_id TO charge_id
  `.catch(() => {});

  await client`
    ALTER TABLE checkout_customers
    RENAME COLUMN abacate_customer_id TO provider_customer_id
  `.catch(() => {});

  // user_id references the legacy sga_db "User" table which lives in a different
  // database — cross-database FK enforcement is impossible, so we drop it here.
  // JWT verification already ensures the userId is valid before any insert.
  await client`
    ALTER TABLE checkout_orders
    DROP CONSTRAINT IF EXISTS checkout_orders_user_id_fkey
  `.catch(() => {});

  await client`
    ALTER TABLE checkout_customers
    DROP CONSTRAINT IF EXISTS checkout_customers_user_id_fkey
  `.catch(() => {});

  await client`
    ALTER TABLE checkout_products
    ADD COLUMN IF NOT EXISTS is_mix BOOLEAN NOT NULL DEFAULT FALSE
  `;

}
