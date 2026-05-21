import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";

import type { AuthApiEnv } from "../../config/env";
import { verifySessionToken } from "../session/session-token";
import type { SessionStore } from "../session/session-store";
import { ADMIN_ROLE, type PlatformUserRepository } from "../users/platform-user-repository";

export type AdminMiddlewareEnv = Pick<AuthApiEnv, "AUTH_COOKIE_NAME" | "JWT_SECRET">;

export function createRequireAdmin(
  env: AdminMiddlewareEnv,
  users: PlatformUserRepository,
  sessions?: SessionStore
): preHandlerHookHandler {
  return async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies[env.AUTH_COOKIE_NAME];

    if (!token) {
      reply.code(401).send({ error: "unauthenticated" });
      return reply;
    }

    const session = await verifySessionToken(token, env);
    if (!session) {
      reply.code(401).send({ error: "unauthenticated" });
      return reply;
    }

    if (sessions && session.sessionId && !(await sessions.exists(session.sessionId))) {
      reply.code(401).send({ error: "unauthenticated" });
      return reply;
    }

    const user = await users.findById(session.userId);
    if (!user || !user.isActive) {
      reply.code(401).send({ error: "unauthenticated" });
      return reply;
    }

    if (user.role !== ADMIN_ROLE) {
      reply.code(403).send({ error: "forbidden" });
      return reply;
    }
  };
}
