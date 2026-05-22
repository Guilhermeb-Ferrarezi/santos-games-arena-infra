import { createPostgresClient, pingPostgres } from "@santos-games/postgres";

import { parseCheckoutApiEnv } from "./config/env";
import { runMigrations } from "./migrations";
import { createAbacatePayClient } from "./modules/checkout/abacate-pay-client";
import { createCustomerRepository } from "./modules/checkout/customer-repository";
import { createOrderRepository } from "./modules/checkout/order-repository";
import { createProductRepository } from "./modules/checkout/product-repository";
import { createCheckoutApiServer } from "./server";

const env = parseCheckoutApiEnv();
const postgresLegacy = createPostgresClient({ DATABASE_URL: env.DATABASE_URL });
const postgresHome = createPostgresClient({ DATABASE_URL: env.DATABASE_HOME });
const orders = createOrderRepository(postgresHome);
const customers = createCustomerRepository(postgresHome);
const products = createProductRepository(postgresHome);
const abacatePay = createAbacatePayClient(env);

await runMigrations(postgresHome);

const server = createCheckoutApiServer({
  env,
  orders,
  customers,
  products,
  abacatePay,
  dependencies: {
    postgresLegacy: () => pingPostgres(postgresLegacy),
    postgresHome: () => pingPostgres(postgresHome)
  }
});

const close = async () => {
  await server.close();
  await postgresLegacy.end({ timeout: 5 });
  await postgresHome.end({ timeout: 5 });
};

process.on("SIGINT", () => {
  close().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  close().finally(() => process.exit(0));
});

await server.listen({
  host: "0.0.0.0",
  port: env.PORT
});
