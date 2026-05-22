import type { Sql } from "postgres";

export type CheckoutProduct = {
  id: number;
  name: string;
  description: string;
  amountCents: number;
};

export type ProductRepository = ReturnType<typeof createProductRepository>;

export function createProductRepository(sql: Sql) {
  async function listActive(): Promise<CheckoutProduct[]> {
    const rows = await sql<CheckoutProduct[]>`
      SELECT id, name, description, amount_cents AS "amountCents"
      FROM checkout_products
      WHERE active = true
      ORDER BY created_at ASC
    `;
    return rows;
  }

  async function findById(id: number): Promise<CheckoutProduct | null> {
    const rows = await sql<CheckoutProduct[]>`
      SELECT id, name, description, amount_cents AS "amountCents"
      FROM checkout_products
      WHERE id = ${id} AND active = true
    `;
    return rows[0] ?? null;
  }

  return { listActive, findById };
}
