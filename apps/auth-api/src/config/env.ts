import { commaSeparatedList, type EnvInput, nonEmptyString, urlString } from "@santos-games/env";
import { z } from "zod";

const authApiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: urlString("DATABASE_URL"),
  REDIS_URL: urlString("REDIS_URL"),
  AUTH_COOKIE_NAME: nonEmptyString("AUTH_COOKIE_NAME").default("sg_auth"),
  AUTH_COOKIE_DOMAIN: z.string().trim().optional(),
  AUTH_PUBLIC_URL: z.string().trim().url().optional(),
  JWT_SECRET: nonEmptyString("JWT_SECRET").min(32, "JWT_SECRET must have at least 32 characters"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  CORS_ORIGINS: commaSeparatedList,
  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
  DISCORD_CLIENT_ID: z.string().trim().optional(),
  DISCORD_CLIENT_SECRET: z.string().trim().optional(),
  STEAM_API_KEY: z.string().trim().optional()
});

export type AuthApiEnv = z.infer<typeof authApiEnvSchema>;

export function parseAuthApiEnv(input: EnvInput = process.env): AuthApiEnv {
  return authApiEnvSchema.parse(input);
}
