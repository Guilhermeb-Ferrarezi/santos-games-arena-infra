import type { PostgresClient } from "@santos-games/postgres";

export type AuthClient = {
  id: number;
  clientId: string;
  name: string;
  allowedRedirectUris: string[];
  isActive: boolean;
};

export type AuthClientRepository = {
  findByClientId(clientId: string): Promise<AuthClient | null>;
  listAll(): Promise<AuthClient[]>;
  create(input: {
    clientId: string;
    name: string;
    allowedRedirectUris: string[];
    isActive?: boolean;
  }): Promise<AuthClient>;
  update(
    id: number,
    input: {
      name?: string;
      allowedRedirectUris?: string[];
      isActive?: boolean;
    }
  ): Promise<AuthClient | null>;
  remove(id: number): Promise<boolean>;
};

type Row = {
  id: number;
  client_id: string;
  name: string;
  allowed_redirect_uris: string[];
  is_active: boolean;
};

function toClient(row: Row): AuthClient {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    allowedRedirectUris: row.allowed_redirect_uris ?? [],
    isActive: row.is_active
  };
}

export function createAuthClientRepository(
  client: PostgresClient
): AuthClientRepository {
  return {
    async findByClientId(clientId) {
      const [row] = await client<Row[]>`
        select id, client_id, name, allowed_redirect_uris, is_active
        from "Auth_Client"
        where client_id = ${clientId}
        limit 1
      `;
      return row ? toClient(row) : null;
    },

    async listAll() {
      const rows = await client<Row[]>`
        select id, client_id, name, allowed_redirect_uris, is_active
        from "Auth_Client"
        order by name asc
      `;
      return rows.map(toClient);
    },

    async create(input) {
      const [row] = await client<Row[]>`
        insert into "Auth_Client" (
          client_id,
          name,
          allowed_redirect_uris,
          is_active,
          created_at,
          updated_at
        )
        values (
          ${input.clientId},
          ${input.name},
          ${client.json(input.allowedRedirectUris)},
          ${input.isActive ?? true},
          now(),
          now()
        )
        returning id, client_id, name, allowed_redirect_uris, is_active
      `;
      return toClient(row);
    },

    async update(id, input) {
      const [row] = await client<Row[]>`
        update "Auth_Client"
        set
          name = coalesce(${input.name ?? null}, name),
          allowed_redirect_uris = coalesce(
            ${input.allowedRedirectUris ? client.json(input.allowedRedirectUris) : null},
            allowed_redirect_uris
          ),
          is_active = coalesce(${input.isActive ?? null}, is_active),
          updated_at = now()
        where id = ${id}
        returning id, client_id, name, allowed_redirect_uris, is_active
      `;
      return row ? toClient(row) : null;
    },

    async remove(id) {
      const result = await client`
        delete from "Auth_Client"
        where id = ${id}
      `;
      return result.count > 0;
    }
  };
}
