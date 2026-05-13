import type { FastifyInstance } from "fastify";

import type { AuthApiEnv } from "../../../config/env";
import { verifySessionToken } from "./session-token";
import type { SessionStore } from "./session-store";
import type { PlatformUserRepository } from "../users/platform-user-repository";
import { needsPasswordSetup } from "../auth/password";

export function registerSessionRoutes(
  server: FastifyInstance,
  env: Pick<AuthApiEnv, "AUTH_COOKIE_DOMAIN" | "AUTH_COOKIE_NAME" | "JWT_SECRET" | "NODE_ENV">,
  sessions?: SessionStore,
  users?: PlatformUserRepository
) {
  server.get("/session", async (request) => {
    const token = request.cookies[env.AUTH_COOKIE_NAME];

    if (!token) {
      return {
        authenticated: false,
        user: null
      };
    }

    const session = await verifySessionToken(token, env);

    if (!session) {
      return {
        authenticated: false,
        user: null
      };
    }

    if (sessions && (!session.sessionId || !(await sessions.exists(session.sessionId)))) {
      return {
        authenticated: false,
        user: null
      };
    }

    const user = users ? await users.findById(session.userId) : null;

    return {
      authenticated: true,
      user: {
        id: session.userId,
        email: session.email,
        login: session.login
      },
      needsPasswordSetup: user ? needsPasswordSetup(user.passwordHash) : false
    };
  });

  server.post("/logout", async (_request, reply) => {
    const token = _request.cookies[env.AUTH_COOKIE_NAME];
    const session = token ? await verifySessionToken(token, env) : null;

    if (session?.sessionId && sessions) {
      await sessions.revoke(session.sessionId);
    }

    reply
      .clearCookie(env.AUTH_COOKIE_NAME, {
        domain: env.AUTH_COOKIE_DOMAIN,
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: env.NODE_ENV === "production"
      })
      .code(204);
  });
}
