import postgres from "postgres";

export type PostgresConfig = {
  DATABASE_URL: string;
};

export type PostgresClient = ReturnType<typeof postgres>;
export type PostgresLikeClient = PostgresClient | ((strings: TemplateStringsArray) => Promise<Array<{ ok: number }>>);

export function createPostgresClient(config: PostgresConfig) {
  return postgres(config.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10
  });
}

export async function pingPostgres(client: PostgresLikeClient): Promise<boolean> {
  const [result] = await client`select 1 as ok`;
  return result?.ok === 1;
}
