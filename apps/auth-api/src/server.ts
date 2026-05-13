import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import type { AuthHealthResponse } from "@santos-games/auth-contracts";
import Fastify from "fastify";
import { registerMongoHttpLogging } from "@santos-games/logs";

import type { AuthApiEnv } from "./config/env";
import { checkDependencies, type DependencyPingers } from "./infra/dependencies";
import { registerAuthRoutes } from "./modules/auth/routes";
import type { ExternalAuthAccountRepository } from "./modules/oauth/external-auth-account-repository";
import type { OAuthClient } from "./modules/oauth/oauth-client";
import { registerOAuthRoutes } from "./modules/oauth/routes";
import { registerSessionRoutes } from "./modules/session/routes";
import type { SessionStore } from "./modules/session/session-store";
import type { PlatformUserRepository } from "./modules/users/platform-user-repository";
import { registerOpenApi } from "./openapi";

const API_PREFIX = "/api";
const AUTH_PREFIX = `${API_PREFIX}/auth`;

export type AuthApiServerOptions = {
  env?: Partial<AuthApiEnv>;
  dependencies?: DependencyPingers;
  externalAccounts?: ExternalAuthAccountRepository;
  oauthClient?: OAuthClient;
  users?: PlatformUserRepository;
  sessions?: SessionStore;
};

export function createAuthApiServer(options: AuthApiServerOptions = {}) {
  const { dependencies, env, externalAccounts, oauthClient, sessions, users } = options;
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
    const routeBlacklist = [
      "/api/auth/session",
      "/api/health",
      "/api/health/dependencies",
      ...(env.LOGS_ROUTE_BLACKLIST ?? [])
    ];
    const getRouteBlacklist = [
      "/api/health",
      "/api/health/dependencies",
      ...(env.LOGS_GET_ROUTE_BLACKLIST ?? [])
    ];

    registerMongoHttpLogging(server, {
      mongoUrl: env.LOGS_MONGO_URL,
      dbName: env.LOGS_MONGO_DB_NAME,
      collectionName: env.LOGS_HTTP_COLLECTION,
      routeBlacklist,
      getRouteBlacklist
    });
  }

  server.register(registerOpenApi, {
    prefix: API_PREFIX
  });

  server.get("/", async (): Promise<AuthHealthResponse> => ({
    status: "ok",
    service: "sga-auth-api"
  }));

  server.get(`${API_PREFIX}/health`, async (): Promise<AuthHealthResponse> => ({
    status: "ok",
    service: "sga-auth-api"
  }));

  if (env?.AUTH_COOKIE_NAME && env.JWT_SECRET && env.NODE_ENV) {
    server.register(
      async (authServer) => {
        registerSessionRoutes(
          authServer,
          {
            AUTH_COOKIE_DOMAIN: env.AUTH_COOKIE_DOMAIN,
            AUTH_COOKIE_NAME: env.AUTH_COOKIE_NAME,
            JWT_SECRET: env.JWT_SECRET,
            NODE_ENV: env.NODE_ENV
          },
          sessions,
          users
        );
      },
      { prefix: AUTH_PREFIX }
    );
  }

  if (
    users &&
    env?.AUTH_COOKIE_NAME &&
    env.JWT_SECRET &&
    env.NODE_ENV &&
    env.SESSION_TTL_SECONDS
  ) {
    server.register(
      async (authServer) => {
        registerAuthRoutes(
          authServer,
          {
            AUTH_COOKIE_DOMAIN: env.AUTH_COOKIE_DOMAIN,
            AUTH_COOKIE_NAME: env.AUTH_COOKIE_NAME,
            JWT_SECRET: env.JWT_SECRET,
            NODE_ENV: env.NODE_ENV,
            SESSION_TTL_SECONDS: env.SESSION_TTL_SECONDS
          },
          users,
          sessions,
          externalAccounts
        );
      },
      { prefix: AUTH_PREFIX }
    );
  }

  if (env?.OAUTH_STATE_TTL_SECONDS) {
    server.register(
      async (authServer) => {
        registerOAuthRoutes(
          authServer,
          {
            AUTH_PUBLIC_URL: env.AUTH_PUBLIC_URL,
            AUTH_COOKIE_DOMAIN: env.AUTH_COOKIE_DOMAIN,
            AUTH_COOKIE_NAME: env.AUTH_COOKIE_NAME ?? "sg_auth",
            DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
            GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
            JWT_SECRET: env.JWT_SECRET ?? "",
            NODE_ENV: env.NODE_ENV ?? "development",
            OAUTH_STATE_TTL_SECONDS: env.OAUTH_STATE_TTL_SECONDS,
            SESSION_TTL_SECONDS: env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 30,
            STEAM_API_KEY: env.STEAM_API_KEY
          },
          {
            externalAccounts,
            oauthClient,
            sessions,
            users
          }
        );
      },
      { prefix: AUTH_PREFIX }
    );
  }

  if (dependencies) {
    try {
      server.get(`${API_PREFIX}/health/dependencies`, async (_request, reply) => {
      const health = await checkDependencies(dependencies);
      

      if (health.status === "degraded") {
        reply.code(503);
      }
      return health;
    });
    }catch(err){console.error(`erro ao rodar: ${err}`);
    }

    
  }
  return server;
}
