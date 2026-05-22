import type { PostgresClient } from "@santos-games/postgres";

type CustomerRow = {
  id: number;
  user_id: number;
  abacate_customer_id: string;
  created_at: string;
};

export type CustomerRepository = ReturnType<typeof createCustomerRepository>;

export function createCustomerRepository(client: PostgresClient) {
  async function findByUserId(userId: number): Promise<string | null> {
    const [row] = await client<CustomerRow[]>`
      select abacate_customer_id from checkout_customers
      where user_id = ${userId}
      limit 1
    `;

    return row?.abacate_customer_id ?? null;
  }

  async function save(userId: number, abacateCustomerId: string): Promise<void> {
    await client`
      insert into checkout_customers (user_id, abacate_customer_id)
      values (${userId}, ${abacateCustomerId})
      on conflict (user_id) do update set abacate_customer_id = ${abacateCustomerId}
    `;
  }

  return { findByUserId, save };
}
