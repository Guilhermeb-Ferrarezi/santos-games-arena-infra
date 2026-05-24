import type { PostgresClient } from "@santos-games/postgres";

export type OrderStatus = "pending" | "paid" | "failed" | "expired";

export type Order = {
  id: number;
  userId: number;
  productId: string;
  description: string;
  amountCents: number;
  status: OrderStatus;
  abacateBillingId: string | null;
  checkoutUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrderRow = {
  id: number;
  user_id: number;
  product_id: string;
  description: string;
  amount_cents: number;
  status: OrderStatus;
  abacate_billing_id: string | null;
  checkout_url: string | null;
  created_at: string;
  updated_at: string;
};

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    description: row.description,
    amountCents: row.amount_cents,
    status: row.status,
    abacateBillingId: row.abacate_billing_id,
    checkoutUrl: row.checkout_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export type OrderRepository = ReturnType<typeof createOrderRepository>;

export function createOrderRepository(client: PostgresClient) {
  async function create(input: {
    userId: number;
    productId: string;
    description: string;
    amountCents: number;
  }): Promise<Order> {
    const [row] = await client<OrderRow[]>`
      insert into checkout_orders (user_id, product_id, description, amount_cents, status)
      values (${input.userId}, ${input.productId}, ${input.description}, ${input.amountCents}, 'pending')
      returning *
    `;

    return toOrder(row);
  }

  async function updateBilling(id: number, billingId: string, checkoutUrl: string | null): Promise<void> {
    await client`
      update checkout_orders
      set abacate_billing_id = ${billingId},
          checkout_url = ${checkoutUrl},
          updated_at = now()
      where id = ${id}
    `;
  }

  async function updateStatus(abacateBillingId: string, status: OrderStatus): Promise<void> {
    await client`
      update checkout_orders
      set status = ${status},
          updated_at = now()
      where abacate_billing_id = ${abacateBillingId}
    `;
  }

  async function findById(id: number, userId: number): Promise<Order | null> {
    const [row] = await client<OrderRow[]>`
      select * from checkout_orders
      where id = ${id} and user_id = ${userId}
      limit 1
    `;

    return row ? toOrder(row) : null;
  }

  async function findByBillingId(abacateBillingId: string): Promise<Order | null> {
    const [row] = await client<OrderRow[]>`
      select * from checkout_orders
      where abacate_billing_id = ${abacateBillingId}
      limit 1
    `;

    return row ? toOrder(row) : null;
  }

  async function cancelById(id: number, userId: number): Promise<boolean> {
    const [row] = await client<{ id: number }[]>`
      update checkout_orders
      set status = 'expired', updated_at = now()
      where id = ${id} and user_id = ${userId} and status = 'pending'
      returning id
    `;
    return !!row;
  }

  return { create, updateBilling, updateStatus, findById, findByBillingId, cancelById };
}
