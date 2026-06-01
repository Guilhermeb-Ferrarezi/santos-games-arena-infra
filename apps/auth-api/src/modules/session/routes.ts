import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthApiEnv } from "../../../config/env";
import { needsPasswordSetup } from "../auth/password";
import type { PlatformUserRepository } from "../users/platform-user-repository";
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  clearAuthCookies,
} from "./issue-tokens";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "./refresh-token";
import type { RefreshTokenRepository } from "./refresh-token-repository";
import { createSessionId, type SessionStore } from "./session-store";
import { createSessionToken, verifySessionToken } from "./session-token";

type SessionEnv = Pick<
  AuthApiEnv,
  | "AUTH_COOKIE_DOMAIN"
  | "AUTH_COOKIE_NAME"
  | "JWT_SECRET"
  | "NODE_ENV"
  | "ACCESS_TOKEN_TTL_SECONDS"
  | "REFRESH_TOKEN_TTL_SECONDS"
>;

function clientIp(request: FastifyRequest): string | null {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return request.ip ?? null;
}

async function clearAndUnauth(
  reply: FastifyReply,
  env: SessionEnv,
  code = 401,
  payload: Record<string, unknown> = { error: "unauthorized", message: "Sessao invalida." },
) {
  clearAuthCookies(reply, env);
  return reply.code(code).send(payload);
}

export function registerSessionRoutes(
  server: FastifyInstance,
  env: SessionEnv,
  sessions?: SessionStore,
  users?: PlatformUserRepository,
  refreshTokens?: RefreshTokenRepository,
) {
  server.get("/session", async (request) => {
    const token = request.cookies[env.AUTH_COOKIE_NAME];

    if (!token) {
      return { authenticated: false, user: null };
    }

    const session = await verifySessionToken(token, env);
    if (!session) {
      return { authenticated: false, user: null };
    }

    if (sessions && (!session.sessionId || !(await sessions.exists(session.sessionId)))) {
      return { authenticated: false, user: null };
    }

    const user = users ? await users.findById(session.userId) : null;

    return {
      authenticated: true,
      user: {
        id: session.userId,
        email: session.email,
        login: session.login,
        role: session.role,
        createdAt: user?.createdAt?.toISOString() ?? null,
        totpEnabled: user?.totpEnabled ?? false,
        totpMethod: user?.totpMethod ?? null,
        avatarUrl: user?.avatarUrl ?? null,
      },
      needsPasswordSetup: user ? needsPasswordSetup(user.passwordHash) : false,
    };
  });

  server.post("/logout", async (request, reply) => {
    const accessToken = request.cookies[env.AUTH_COOKIE_NAME];
    const session = accessToken ? await verifySessionToken(accessToken, env) : null;

    if (session?.sessionId && sessions) {
      await sessions.revoke(session.sessionId);
    }

    const refreshCookie = request.cookies[REFRESH_COOKIE_NAME];
    if (refreshCookie && refreshTokens) {
      await refreshTokens.revokeByHash(hashRefreshToken(refreshCookie));
    }

    clearAuthCookies(reply, env);
    return reply.code(204).send();
  });

  if (refreshTokens) {
    server.post("/refresh", async (request, reply) => {
      const refreshCookie = request.cookies[REFRESH_COOKIE_NAME];
      if (!refreshCookie) {
        return clearAndUnauth(reply, env, 401, {
          error: "no_refresh_token",
          message: "Refresh token ausente.",
        });
      }

      const oldHash = hashRefreshToken(refreshCookie);
      const lookup = await refreshTokens.findByHash(oldHash);

      if (!lookup) {
        return clearAndUnauth(reply, env, 401, {
          error: "invalid_refresh_token",
          message: "Refresh token invalido ou expirado.",
        });
      }

      const user = users ? await users.findById(lookup.userId) : null;
      if (!user || !user.isActive) {
        await refreshTokens.revokeByHash(oldHash);
        return clearAndUnauth(reply, env, 401, {
          error: "user_unavailable",
          message: "Usuario nao encontrado ou inativo.",
        });
      }

      const newPlaintext = generateRefreshToken();
      const newHash = hashRefreshToken(newPlaintext);
      const refreshTtl = env.REFRESH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 30;
      const expiresAt = new Date(Date.now() + refreshTtl * 1000);

      await refreshTokens.rotate(oldHash, {
        userId: user.id,
        newTokenHash: newHash,
        deviceLabel: request.headers["user-agent"]?.slice(0, 200) ?? null,
        ip: clientIp(request),
        userAgent: request.headers["user-agent"] ?? null,
        expiresAt,
      });

      const accessTtl = env.ACCESS_TOKEN_TTL_SECONDS ?? 900;

      // Cria nova sessão no Redis para que GET /session valide o sessionId
      const sessionId = createSessionId();
      if (sessions) {
        await sessions.create({ sessionId, userId: user.id, ttlSeconds: refreshTtl });
      }

      const accessToken = await createSessionToken(
        {
          userId: user.id,
          email: user.email,
          login: user.login,
          role: user.role,
          sessionId,
        },
        { JWT_SECRET: env.JWT_SECRET, SESSION_TTL_SECONDS: accessTtl },
      );

      reply.setCookie(env.AUTH_COOKIE_NAME, accessToken, {
        domain: env.AUTH_COOKIE_DOMAIN,
        httpOnly: true,
        maxAge: accessTtl,
        path: "/",
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
      });

      reply.setCookie(REFRESH_COOKIE_NAME, newPlaintext, {
        domain: env.AUTH_COOKIE_DOMAIN,
        httpOnly: true,
        maxAge: refreshTtl,
        path: REFRESH_COOKIE_PATH,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
      });

      return {
        authenticated: true,
        user: { id: user.id, email: user.email, login: user.login, role: user.role },
      };
    });

    server.get("/sessions", async (request, reply) => {
      const accessToken = request.cookies[env.AUTH_COOKIE_NAME];
      const session = accessToken ? await verifySessionToken(accessToken, env) : null;
      if (!session) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (sessions && (!session.sessionId || !(await sessions.exists(session.sessionId)))) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const list = await refreshTokens.listByUser(session.userId);
      const currentRefresh = request.cookies[REFRESH_COOKIE_NAME];
      const currentHash = currentRefresh ? hashRefreshToken(currentRefresh) : null;

      return {
        sessions: list.map((r) => ({
          id: r.id,
          deviceLabel: r.deviceLabel,
          ip: r.ip,
          userAgent: r.userAgent,
          createdAt: r.createdAt.toISOString(),
          lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
          expiresAt: r.expiresAt.toISOString(),
          current: r.tokenHash === currentHash,
        })),
      };
    });

    server.delete("/sessions/:id", async (request, reply) => {
      const accessToken = request.cookies[env.AUTH_COOKIE_NAME];
      const session = accessToken ? await verifySessionToken(accessToken, env) : null;
      if (!session) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (sessions && (!session.sessionId || !(await sessions.exists(session.sessionId)))) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const id = Number((request.params as { id: string }).id);
      if (!Number.isFinite(id)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      await refreshTokens.revoke(id, session.userId);
      return reply.code(204).send();
    });

    server.post("/sessions/revoke-others", async (request, reply) => {
      const accessToken = request.cookies[env.AUTH_COOKIE_NAME];
      const session = accessToken ? await verifySessionToken(accessToken, env) : null;
      if (!session) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (sessions && (!session.sessionId || !(await sessions.exists(session.sessionId)))) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const currentRefresh = request.cookies[REFRESH_COOKIE_NAME];
      if (!currentRefresh) {
        return reply.code(400).send({ error: "no_current_session" });
      }

      const currentHash = hashRefreshToken(currentRefresh);
      const count = await refreshTokens.revokeOthers(session.userId, currentHash);
      return { revoked: count };
    });

    server.post("/sessions/revoke-all", async (request, reply) => {
      const accessToken = request.cookies[env.AUTH_COOKIE_NAME];
      const session = accessToken ? await verifySessionToken(accessToken, env) : null;
      if (!session) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (sessions && (!session.sessionId || !(await sessions.exists(session.sessionId)))) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const count = await refreshTokens.revokeAll(session.userId);
      clearAuthCookies(reply, env);
      return { revoked: count };
    });
  }
}
