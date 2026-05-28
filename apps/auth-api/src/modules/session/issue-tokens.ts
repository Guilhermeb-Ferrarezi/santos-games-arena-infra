import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthApiEnv } from "../../config/env";
import { generateRefreshToken, hashRefreshToken } from "./refresh-token";
import type { RefreshTokenRepository } from "./refresh-token-repository";
import { createSessionId, type SessionStore } from "./session-store";
import { createSessionToken } from "./session-token";

export const REFRESH_COOKIE_NAME = "sga_refresh";
export const REFRESH_COOKIE_PATH = "/api/auth";

export type IssueTokensInput = {
  user: { id: number; email: string; login: string; role: number };
  request: FastifyRequest;
  reply: FastifyReply;
};

export type IssueTokensEnv = Pick<
  AuthApiEnv,
  | "AUTH_COOKIE_DOMAIN"
  | "AUTH_COOKIE_NAME"
  | "JWT_SECRET"
  | "NODE_ENV"
  | "ACCESS_TOKEN_TTL_SECONDS"
  | "REFRESH_TOKEN_TTL_SECONDS"
  | "SESSION_TTL_SECONDS"
>;

function deviceLabel(userAgent: string | null): string | null {
  if (!userAgent) return null;
  return userAgent.slice(0, 200);
}

function clientIp(request: FastifyRequest): string | null {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return request.ip ?? null;
}

export async function issueTokens({
  user,
  request,
  reply,
  env,
  sessions,
  refreshTokens,
}: IssueTokensInput & {
  env: IssueTokensEnv;
  sessions?: SessionStore;
  refreshTokens?: RefreshTokenRepository;
}): Promise<{ accessTokenTtl: number; refreshIssued: boolean }> {
  const accessTtl = env.ACCESS_TOKEN_TTL_SECONDS ?? 900;
  const refreshTtl = env.REFRESH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 30;
  const sessionId = createSessionId();

  if (sessions) {
    await sessions.create({
      sessionId,
      userId: user.id,
      ttlSeconds: refreshTtl,
    });
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

  let refreshIssued = false;
  if (refreshTokens) {
    const refreshPlaintext = generateRefreshToken();
    const refreshHash = hashRefreshToken(refreshPlaintext);
    const expiresAt = new Date(Date.now() + refreshTtl * 1000);

    await refreshTokens.create({
      userId: user.id,
      tokenHash: refreshHash,
      deviceLabel: deviceLabel(request.headers["user-agent"] ?? null),
      ip: clientIp(request),
      userAgent: request.headers["user-agent"] ?? null,
      expiresAt,
    });

    reply.setCookie(REFRESH_COOKIE_NAME, refreshPlaintext, {
      domain: env.AUTH_COOKIE_DOMAIN,
      httpOnly: true,
      maxAge: refreshTtl,
      path: REFRESH_COOKIE_PATH,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
    });
    refreshIssued = true;
  }

  return { accessTokenTtl: accessTtl, refreshIssued };
}

export function clearAuthCookies(reply: FastifyReply, env: IssueTokensEnv) {
  reply.clearCookie(env.AUTH_COOKIE_NAME, {
    domain: env.AUTH_COOKIE_DOMAIN,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  });
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    domain: env.AUTH_COOKIE_DOMAIN,
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  });
}
