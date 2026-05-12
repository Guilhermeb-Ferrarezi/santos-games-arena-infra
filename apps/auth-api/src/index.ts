import { createPostgresClient, pingPostgres } from "@santos-games/postgres";
import { createRedisClient, pingRedis } from "@santos-games/redis";

import { parseAuthApiEnv } from "./config/env";
import { createExternalAuthAccountRepository } from "./modules/oauth/external-auth-account-repository";
import { createOAuthClient } from "./modules/oauth/oauth-client";
import { createRedisSessionStore } from "./modules/session/session-store";
import { createPlatformUserRepository } from "./modules/users/platform-user-repository";
import { createAuthApiServer } from "./server";

const env = parseAuthApiEnv();
const postgres = createPostgresClient(env);
const redis = createRedisClient(env);
const externalAccounts = createExternalAuthAccountRepository(postgres);
const oauthClient = createOAuthClient(env);
const users = createPlatformUserRepository(postgres);
const sessions = createRedisSessionStore(redis);
const server = createAuthApiServer({
  env,
  externalAccounts,
  oauthClient,
  sessions,
  users,
  dependencies: {
    postgres: () => pingPostgres(postgres),
    redis: () => pingRedis(redis)
  }
});

const close = async () => {
  await server.close();
  await postgres.end({ timeout: 5 });
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
