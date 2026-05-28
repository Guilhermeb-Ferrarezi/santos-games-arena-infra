import { commaSeparatedList, type EnvInput, nonEmptyString, urlString } from "@santos-games/env";
import { z } from "zod";

const checkoutApiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: urlString("DATABASE_URL"),
  DATABASE_HOME: urlString("DATABASE_HOME"),
  JWT_SECRET: nonEmptyString("JWT_SECRET").min(32, "JWT_SECRET must have at least 32 characters"),
  AUTH_COOKIE_NAME: nonEmptyString("AUTH_COOKIE_NAME").default("sga_auth"),
  CORS_ORIGINS: commaSeparatedList,
  DOTFY_API_KEY: nonEmptyString("DOTFY_API_KEY"),
  DOTFY_WEBHOOK_SECRET: nonEmptyString("DOTFY_WEBHOOK_SECRET"),
  DOTFY_API_URL: z.string().trim().url().default("https://app.dotfy.com.br"),
  REDIS_URL: urlString("REDIS_URL"),
  LOGS_MONGO_URL: z.string().trim().url().optional(),
  LOGS_MONGO_DB_NAME: z.string().trim().min(1).default("logs"),
  LOGS_HTTP_COLLECTION: z.string().trim().min(1).default("sga_checkout_api_logs"),
  CHECKOUT_WEB_URL: z.string().trim().url().optional(),
  RESEND_API_KEY: z.string().trim().min(1).optional(),
  RESEND_FROM: z.string().trim().min(1).default("Santos Games <noreply@santos-games.com>"),
  CORUJAO_API_URL: z.string().trim().url().optional(),
  CORUJAO_INTERNAL_SECRET: z.string().trim().min(1).optional(),
  LOGS_ROUTE_BLACKLIST: commaSeparatedList,
  LOGS_GET_ROUTE_BLACKLIST: commaSeparatedList
});

export type CheckoutApiEnv = z.infer<typeof checkoutApiEnvSchema>;

export function parseCheckoutApiEnv(input: EnvInput = process.env): CheckoutApiEnv {
  return checkoutApiEnvSchema.parse(input);
}
