import type { PostgresClient } from "@santos-games/postgres";

export type CouponRow = {
  id: number;
  code: string;
  discount_percent: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
};

export type CouponRepository = ReturnType<typeof createCouponRepository>;

export function createCouponRepository(client: PostgresClient) {
  async function findActiveByCode(code: string): Promise<CouponRow | null> {
    const [row] = await client<CouponRow[]>`
      SELECT id, code, discount_percent, max_uses, used_count, expires_at, active
      FROM checkout_coupons
      WHERE code = ${code.toUpperCase()}
        AND active = true
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (max_uses IS NULL OR used_count < max_uses)
      LIMIT 1
    `;
    return row ?? null;
  }

  async function incrementUsage(id: number): Promise<boolean> {
    const result = await client<{ id: number }[]>`
      UPDATE checkout_coupons
      SET used_count = used_count + 1, updated_at = NOW()
      WHERE id = ${id}
        AND (max_uses IS NULL OR used_count < max_uses)
      RETURNING id
    `;
    return result.length > 0;
  }

  return { findActiveByCode, incrementUsage };
}
