import type { Sql } from "postgres";

export type CheckoutProduct = {
  id: number;
  name: string;
  description: string;
  features: string[];
  amountCents: number;
  discountPercent: number | null;
  imageKey: string | null;
  imageUrl: string | null;
  isCorujao: boolean;
};

export type ProductRepository = ReturnType<typeof createProductRepository>;

export function createProductRepository(sql: Sql) {
  async function listActive(): Promise<CheckoutProduct[]> {
    const rows = await sql<CheckoutProduct[]>`
      SELECT id, name, description, COALESCE(features, '[]'::jsonb) AS features,
             amount_cents AS "amountCents", discount_percent AS "discountPercent",
             image_key AS "imageKey", image_url AS "imageUrl",
             COALESCE(is_corujao, false) AS "isCorujao"
      FROM checkout_products
      WHERE active = true
      ORDER BY created_at ASC
    `;
    return rows;
  }

  async function findById(id: number): Promise<CheckoutProduct | null> {
    const rows = await sql<CheckoutProduct[]>`
      SELECT id, name, description, COALESCE(features, '[]'::jsonb) AS features,
             amount_cents AS "amountCents", discount_percent AS "discountPercent",
             image_key AS "imageKey", image_url AS "imageUrl",
             COALESCE(is_corujao, false) AS "isCorujao"
      FROM checkout_products
      WHERE id = ${id} AND active = true
    `;
    return rows[0] ?? null;
  }

  async function isCorujao(productId: string): Promise<boolean> {
    const rows = await sql<{ is_corujao: boolean }[]>`
      SELECT COALESCE(is_corujao, false) AS is_corujao
      FROM checkout_products
      WHERE id = ${Number(productId)}
      LIMIT 1
    `;
    return rows[0]?.is_corujao ?? false;
  }

  return { listActive, findById, isCorujao };
}
