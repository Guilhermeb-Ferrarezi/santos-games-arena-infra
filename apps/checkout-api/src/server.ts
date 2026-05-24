import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { registerMongoHttpLogging } from "@santos-games/logs";
import Fastify from "fastify";

import type { CheckoutApiEnv } from "./config/env";
import { checkDependencies, type DependencyPingers } from "./infra/dependencies";
import type { AbacatePayClient } from "./modules/checkout/abacate-pay-client";
import type { CustomerRepository } from "./modules/checkout/customer-repository";
import { registerCheckoutRoutes } from "./modules/checkout/routes";
import type { OrderRepository } from "./modules/checkout/order-repository";
import type { PixStore } from "./modules/checkout/pix-store";
import type { ProductRepository } from "./modules/checkout/product-repository";
import { registerWebhookRoutes } from "./modules/webhook/routes";

const API_PREFIX = "/api";
const CHECKOUT_PREFIX = `${API_PREFIX}/checkout`;

export type CheckoutApiServerOptions = {
  env?: Partial<CheckoutApiEnv>;
  dependencies?: DependencyPingers;
  orders?: OrderRepository;
  customers?: CustomerRepository;
  products?: ProductRepository;
  abacatePay?: AbacatePayClient;
  pixStore?: PixStore;
};

export function createCheckoutApiServer(options: CheckoutApiServerOptions = {}) {
  const { env, dependencies, orders, customers, products, abacatePay, pixStore } = options;

  const server = Fastify({
    logger: env?.NODE_ENV === "production"
  });

  server.register(cookie, {
    secret: env?.JWT_SECRET
  });

  server.register(cors, {
    origin: env?.CORS_ORIGINS?.length ? env.CORS_ORIGINS : true,
    credentials: true
  });

  if (env?.LOGS_MONGO_URL) {
    registerMongoHttpLogging(server, {
      mongoUrl: env.LOGS_MONGO_URL,
      dbName: env.LOGS_MONGO_DB_NAME,
      collectionName: env.LOGS_HTTP_COLLECTION,
      routeBlacklist: [
        `${API_PREFIX}/health`,
        `${API_PREFIX}/health/dependencies`,
        ...(env.LOGS_ROUTE_BLACKLIST ?? [])
      ],
      getRouteBlacklist: [
        `${API_PREFIX}/health`,
        `${API_PREFIX}/health/dependencies`,
        ...(env.LOGS_GET_ROUTE_BLACKLIST ?? [])
      ]
    });
  }

  server.get(`${API_PREFIX}/health`, async () => ({
    status: "ok",
    service: "sga-checkout-api"
  }));

  if (dependencies) {
    server.get(`${API_PREFIX}/health/dependencies`, async (_request, reply) => {
      const health = await checkDependencies(dependencies);
      if (health.status === "degraded") {
        reply.code(503);
      }
      return health;
    });
  }

  if (orders && customers && products && abacatePay && pixStore && env?.JWT_SECRET && env.AUTH_COOKIE_NAME) {
    server.register(
      async (checkoutServer) => {
        registerCheckoutRoutes(
          checkoutServer,
          {
            JWT_SECRET: env.JWT_SECRET!,
            AUTH_COOKIE_NAME: env.AUTH_COOKIE_NAME!,
            CHECKOUT_WEB_URL: env.CHECKOUT_WEB_URL
          },
          orders,
          customers,
          products,
          abacatePay,
          pixStore
        );
      },
      { prefix: CHECKOUT_PREFIX }
    );
  }

  if (orders && env?.ABACATE_PAY_WEBHOOK_SECRET) {
    server.register(
      async (webhookServer) => {
        registerWebhookRoutes(
          webhookServer,
          { ABACATE_PAY_WEBHOOK_SECRET: env.ABACATE_PAY_WEBHOOK_SECRET! },
          orders
        );
      },
      { prefix: CHECKOUT_PREFIX }
    );
  }

  return server;
}
