import { createPostgresClient, pingPostgres } from "@santos-games/postgres";
import { createRedisClient, pingRedis } from "@santos-games/redis";

import { parseCheckoutApiEnv } from "./config/env";
import { runMigrations } from "./migrations";
import { createDotfyClient } from "./modules/checkout/dotfy-client";
import { createCouponRepository } from "./modules/checkout/coupon-repository";
import { createCustomerRepository } from "./modules/checkout/customer-repository";
import { createOrderRepository } from "./modules/checkout/order-repository";
import { createPayIntentStore } from "./modules/checkout/pay-intent-store";
import { createPixStore } from "./modules/checkout/pix-store";
import { createProductRepository } from "./modules/checkout/product-repository";
import { createCheckoutApiServer } from "./server";

const env = parseCheckoutApiEnv();
const postgresLegacy = createPostgresClient({ DATABASE_URL: env.DATABASE_URL });
const postgresHome = createPostgresClient({ DATABASE_URL: env.DATABASE_HOME });
const redis = createRedisClient({ REDIS_URL: env.REDIS_URL });
const orders = createOrderRepository(postgresHome);
const customers = createCustomerRepository(postgresHome);
const products = createProductRepository(postgresHome);
const coupons = createCouponRepository(postgresHome);
const dotfy = createDotfyClient(env);
const pixStore = createPixStore(redis);
const payIntentStore = createPayIntentStore(redis);

await runMigrations(postgresHome);

const server = createCheckoutApiServer({
  env,
  orders,
  customers,
  products,
  coupons,
  dotfy,
  pixStore,
  payIntentStore,
  dependencies: {
    postgresLegacy: () => pingPostgres(postgresLegacy),
    postgresHome: () => pingPostgres(postgresHome),
    redis: () => pingRedis(redis)
  }
});

const close = async () => {
  await server.close();
  await postgresLegacy.end({ timeout: 5 });
  await postgresHome.end({ timeout: 5 });
  redis.disconnect();
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
