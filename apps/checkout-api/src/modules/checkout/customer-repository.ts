import type { PostgresClient } from "@santos-games/postgres";

type CustomerRow = {
  id: number;
  user_id: number;
  provider_customer_id: string;
  user_login: string | null;
  user_email: string | null;
  name: string | null;
  tax_id: string | null;
  cellphone: string | null;
  created_at: string;
};

export type CustomerInfo = {
  name: string | null;
  taxId: string | null;
  cellphone: string | null;
  email: string | null;
};

export type CustomerRepository = ReturnType<typeof createCustomerRepository>;

export function createCustomerRepository(client: PostgresClient) {
  async function findByUserId(userId: number): Promise<string | null> {
    const [row] = await client<CustomerRow[]>`
      select provider_customer_id from checkout_customers
      where user_id = ${userId}
      limit 1
    `;

    return row?.provider_customer_id ?? null;
  }

  async function getInfo(userId: number): Promise<CustomerInfo | null> {
    const [row] = await client<CustomerRow[]>`
      select name, tax_id, cellphone, user_email from checkout_customers
      where user_id = ${userId}
      limit 1
    `;

    if (!row) return null;
    return {
      name: row.name ?? null,
      taxId: row.tax_id ?? null,
      cellphone: row.cellphone ?? null,
      email: row.user_email ?? null
    };
  }

  async function save(
    userId: number,
    providerCustomerId: string,
    userLogin?: string,
    userEmail?: string
  ): Promise<void> {
    await client`
      insert into checkout_customers (user_id, provider_customer_id, user_login, user_email)
      values (${userId}, ${providerCustomerId}, ${userLogin ?? null}, ${userEmail ?? null})
      on conflict (user_id) do update set
        provider_customer_id = ${providerCustomerId},
        user_login = ${userLogin ?? null},
        user_email = ${userEmail ?? null}
    `;
  }

  async function saveInfo(
    userId: number,
    info: { name: string; taxId: string; cellphone: string; email?: string; login?: string }
  ): Promise<void> {
    await client`
      insert into checkout_customers (user_id, provider_customer_id, name, tax_id, cellphone, user_email, user_login)
      values (${userId}, '', ${info.name}, ${info.taxId}, ${info.cellphone}, ${info.email ?? null}, ${info.login ?? null})
      on conflict (user_id) do update set
        name = ${info.name},
        tax_id = ${info.taxId},
        cellphone = ${info.cellphone},
        user_email = coalesce(${info.email ?? null}, checkout_customers.user_email),
        user_login = coalesce(${info.login ?? null}, checkout_customers.user_login)
    `;
  }

  return { findByUserId, getInfo, save, saveInfo };
}
