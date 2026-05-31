import { commaSeparatedList, type EnvInput, nonEmptyString, urlString } from "@santos-games/env";
import { z } from "zod";

const authApiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: urlString("DATABASE_URL"),
  REDIS_URL: urlString("REDIS_URL"),
  AUTH_COOKIE_NAME: nonEmptyString("AUTH_COOKIE_NAME").default("sga_auth"),
  AUTH_COOKIE_DOMAIN: z.string().trim().optional(),
  AUTH_PUBLIC_URL: z.string().trim().url().optional(),
  JWT_SECRET: nonEmptyString("JWT_SECRET").min(32, "JWT_SECRET must have at least 32 characters"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  CORS_ORIGINS: commaSeparatedList,
  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
  DISCORD_CLIENT_ID: z.string().trim().optional(),
  DISCORD_CLIENT_SECRET: z.string().trim().optional(),
  STEAM_API_KEY: z.string().trim().optional(),
  LOGS_MONGO_URL: z.string().trim().url().optional(),
  LOGS_MONGO_DB_NAME: z.string().trim().min(1).default("logs"),
  LOGS_HTTP_COLLECTION: z.string().trim().min(1).default("sga_auth_api_logs"),
  LOGS_ROUTE_BLACKLIST: commaSeparatedList,
  LOGS_GET_ROUTE_BLACKLIST: commaSeparatedList,
  // Email (Resend)
  RESEND_API_KEY: z.string().trim().optional(),
  RESEND_FROM_EMAIL: z.string().trim().email().optional(),
  APP_BASE_URL: z.string().trim().url().optional(),
  // URL pública da plataforma web (para links de confirmação de e-mail etc.)
  SGA_WEB_URL: z.string().trim().url().optional(),
  // Cloudflare R2
  R2_ENDPOINT: z.string().trim().url().optional(),
  R2_ACCESS_KEY_ID: z.string().trim().optional(),
  R2_SECRET_ACCESS_KEY: z.string().trim().optional(),
  R2_BUCKET: z.string().trim().optional(),
  R2_PUBLIC_URL: z.string().trim().url().optional(),
});

export type AuthApiEnv = z.infer<typeof authApiEnvSchema>;

export function parseAuthApiEnv(input: EnvInput = process.env): AuthApiEnv {
  return authApiEnvSchema.parse(input);
}
