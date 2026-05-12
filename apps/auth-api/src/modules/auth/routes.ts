import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AuthApiEnv } from "../../../config/env";
import { createLegacyPasswordHash, verifyPassword } from "./password";
import type { PlatformUserRepository } from "../users/platform-user-repository";
import { createSessionToken } from "../session/session-token";
import { createSessionId, type SessionStore } from "../session/session-store";
import type { OAuthProvider } from "../oauth/providers";
import type { ExternalAuthAccountRepository } from "../oauth/external-auth-account-repository";
import { isOAuthProvider } from "../oauth/providers";

const loginBodySchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1)
});

const registerBodySchema = z.object({
  email: z.string().trim().email(),
  login: z.string().trim().min(3).max(48),
  password: z.string().min(8),
  provider: z.string().trim().min(1).optional(),
  externalAccountId: z.string().trim().min(1).optional(),
  displayName: z.string().trim().min(1).optional(),
  avatarUrl: z.string().trim().url().optional()
});

export function registerAuthRoutes(
  server: FastifyInstance,
  env: Pick<
    AuthApiEnv,
    | "AUTH_COOKIE_DOMAIN"
    | "AUTH_COOKIE_NAME"
    | "JWT_SECRET"
    | "NODE_ENV"
    | "SESSION_TTL_SECONDS"
  >,
  users: PlatformUserRepository,
  sessions?: SessionStore,
  externalAccounts?: ExternalAuthAccountRepository
) {
  server.post("/login", async (request, reply) => {
    const parsedBody = loginBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "Dados de login invalidos."
      });
    }

    const user = await users.findByIdentifier(parsedBody.data.identifier);

    if (!user) {
      return reply.code(401).send({
        error: "invalid_credentials",
        message: "Credenciais invalidas."
      });
    }

    if (!user.isActive) {
      return reply.code(403).send({
        error: "user_inactive",
        message: "Usuario inativo."
      });
    }

    const passwordMatches = await verifyPassword(
      parsedBody.data.password,
      user.passwordHash,
      env
    );

    if (!passwordMatches) {
      return reply.code(401).send({
        error: "invalid_credentials",
        message: "Credenciais invalidas."
      });
    }

    await users.updateLastLogin(user.id);

    const sessionId = createSessionId();

    if (sessions) {
      await sessions.create({
        sessionId,
        userId: user.id,
        ttlSeconds: env.SESSION_TTL_SECONDS
      });
    }

    const token = await createSessionToken(
      {
        userId: user.id,
        email: user.email,
        login: user.login,
        sessionId
      },
      env
    );

    reply.setCookie(env.AUTH_COOKIE_NAME, token, {
      domain: env.AUTH_COOKIE_DOMAIN,
      httpOnly: true,
      maxAge: env.SESSION_TTL_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: env.NODE_ENV === "production"
    });

    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        login: user.login
      }
    };
  });

  server.post("/register", async (request, reply) => {
    const parsedBody = registerBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "Dados de cadastro invalidos."
      });
    }

    const normalizedEmail = parsedBody.data.email.trim().toLowerCase();
    const normalizedLogin = parsedBody.data.login.trim().toLowerCase();
    const existingUser = await users.findByIdentifier(normalizedEmail);
    const existingLogin = normalizedLogin === normalizedEmail
      ? existingUser
      : await users.findByIdentifier(normalizedLogin);

    if (existingUser || existingLogin) {
      return reply.code(409).send({
        error: "user_exists",
        message: "Ja existe uma conta com este email ou login."
      });
    }

    if (parsedBody.data.provider && !isOAuthProvider(parsedBody.data.provider)) {
      return reply.code(400).send({
        error: "invalid_provider",
        message: "Provedor de autenticacao invalido."
      });
    }

    if (parsedBody.data.provider && !parsedBody.data.externalAccountId) {
      return reply.code(400).send({
        error: "missing_external_account",
        message: "Conta externa ausente."
      });
    }

    if (parsedBody.data.provider && !externalAccounts) {
      return reply.code(503).send({
        error: "external_accounts_not_ready",
        message: "Vinculo de conta externa nao esta pronto neste ambiente."
      });
    }

    const passwordHash = await createLegacyPasswordHash(parsedBody.data.password, env.JWT_SECRET);
    const user = await users.createUser({
      email: normalizedEmail,
      login: normalizedLogin,
      passwordHash
    });

    const provider = parsedBody.data.provider as OAuthProvider | undefined;
    if (provider && parsedBody.data.externalAccountId && externalAccounts) {
      await externalAccounts.linkToUser({
        provider,
        externalAccountId: parsedBody.data.externalAccountId,
        email: normalizedEmail,
        displayName: parsedBody.data.displayName,
        avatarUrl: parsedBody.data.avatarUrl,
        userId: user.id
      });
    }

    await users.updateLastLogin(user.id);

    const sessionId = createSessionId();

    if (sessions) {
      await sessions.create({
        sessionId,
        userId: user.id,
        ttlSeconds: env.SESSION_TTL_SECONDS
      });
    }

    const token = await createSessionToken(
      {
        userId: user.id,
        email: user.email,
        login: user.login,
        sessionId
      },
      env
    );

    reply.setCookie(env.AUTH_COOKIE_NAME, token, {
      domain: env.AUTH_COOKIE_DOMAIN,
      httpOnly: true,
      maxAge: env.SESSION_TTL_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: env.NODE_ENV === "production"
    });

    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        login: user.login
      }
    };
  });
}
