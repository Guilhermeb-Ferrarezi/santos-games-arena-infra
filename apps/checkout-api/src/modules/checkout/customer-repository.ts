import type { PostgresClient } from "@santos-games/postgres";

type CustomerRow = {
  id: number;
  user_id: number;
  abacate_customer_id: string;
  user_login: string | null;
  user_email: string | null;
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

  async function save(
    userId: number,
    abacateCustomerId: string,
    userLogin?: string,
    userEmail?: string
  ): Promise<void> {
    await client`
      insert into checkout_customers (user_id, abacate_customer_id, user_login, user_email)
      values (${userId}, ${abacateCustomerId}, ${userLogin ?? null}, ${userEmail ?? null})
      on conflict (user_id) do update set
        abacate_customer_id = ${abacateCustomerId},
        user_login = ${userLogin ?? null},
        user_email = ${userEmail ?? null}
    `;
  }

  return { findByUserId, save };
}
