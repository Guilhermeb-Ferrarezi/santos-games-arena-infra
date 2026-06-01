import type { FastifyInstance, FastifyReply } from "fastify";
import { randomUUID } from "crypto";
import { z } from "zod";

import type { AuthApiEnv } from "../../../config/env";
import { createPasswordHash, verifyPassword } from "./password";
import type { AuthClientRepository } from "../clients/client-repository";
import { resolveClientRedirect } from "../clients/validate-redirect";
import type { PlatformUserRepository } from "../users/platform-user-repository";
import { issueTokens } from "../session/issue-tokens";
import type { RefreshTokenRepository } from "../session/refresh-token-repository";
import type { SessionStore } from "../session/session-store";
import type { OAuthProvider } from "../oauth/providers";
import type { ExternalAuthAccountRepository } from "../oauth/external-auth-account-repository";
import { isOAuthProvider } from "../oauth/providers";
import { verifySessionToken } from "../session/session-token";
import type { EmailService } from "../email/email-service";
import { verifyTotpCode, verifyBackupCode, generateEmailOtp, hashEmailOtp, safeCompareHex, consumeOtpAttempt } from "../totp/totp";

const clientFlowFields = {
  clientId: z.string().trim().min(1).optional(),
  redirectUri: z.string().trim().url().optional()
} as const;

const loginBodySchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
  ...clientFlowFields
});

const setPasswordBodySchema = z.object({
  password: z.string().min(8),
  currentPassword: z.string().min(1).optional(),
  ...clientFlowFields
});

const registerBodySchema = z.object({
  email: z.string().trim().email(),
  login: z.string().trim().min(3).max(48),
  password: z.string().min(8),
  provider: z.string().trim().min(1).optional(),
  externalAccountId: z.string().trim().min(1).optional(),
  displayName: z.string().trim().min(1).optional(),
  avatarUrl: z.string().trim().url().optional(),
  ...clientFlowFields
});

async function resolveOptionalRedirect(
  reply: FastifyReply,
  authClients: AuthClientRepository | undefined,
  input: { clientId?: string; redirectUri?: string }
): Promise<{ redirectUri: string | null } | "sent_error"> {
  if (!input.clientId && !input.redirectUri) {
    return { redirectUri: null };
  }

  if (!authClients) {
    reply.code(503).send({ error: "clients_not_ready", message: "Validacao de aplicacao indisponivel neste ambiente." });
    return "sent_error";
  }

  const result = await resolveClientRedirect(authClients, {
    clientId: input.clientId,
    redirectUri: input.redirectUri
  });

  if (!result.ok) {
    reply.code(400).send({ error: result.error.reason, message: "Aplicacao ou redirect_uri invalidos." });
    return "sent_error";
  }

  return { redirectUri: result.resolved.redirectUri };
}

function clientIp(request: Parameters<Parameters<FastifyInstance["post"]>[1]>[0]): string | null {
  const fwd = request.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]?.trim() ?? null;
  return (request as any).ip ?? null;
}

export function registerAuthRoutes(
  server: FastifyInstance,
  env: Pick<
    AuthApiEnv,
    | "AUTH_COOKIE_DOMAIN" | "AUTH_COOKIE_NAME" | "JWT_SECRET" | "NODE_ENV"
    | "SESSION_TTL_SECONDS" | "ACCESS_TOKEN_TTL_SECONDS" | "REFRESH_TOKEN_TTL_SECONDS"
    | "APP_BASE_URL"
  >,
  users: PlatformUserRepository,
  sessions?: SessionStore,
  externalAccounts?: ExternalAuthAccountRepository,
  authClients?: AuthClientRepository,
  refreshTokens?: RefreshTokenRepository,
  emailService?: EmailService,
  redis?: import("ioredis").Redis,
) {
  server.get("/client", async (request, reply) => {
    const query = request.query as { client_id?: string; redirect_uri?: string };
    if (!authClients) return reply.code(503).send({ error: "clients_not_ready" });

    const result = await resolveClientRedirect(authClients, { clientId: query.client_id, redirectUri: query.redirect_uri });
    if (!result.ok) return reply.code(400).send({ error: result.error.reason });

    return {
      ok: true,
      client: { clientId: result.resolved.client.clientId, name: result.resolved.client.name },
      redirectUri: result.resolved.redirectUri
    };
  });

  server.post("/login", async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", message: "Dados de login invalidos." });

    const redirect = await resolveOptionalRedirect(reply, authClients, parsed.data);
    if (redirect === "sent_error") return;

    const user = await users.findByIdentifier(parsed.data.identifier);
    if (!user) return reply.code(401).send({ error: "invalid_credentials", message: "Credenciais invalidas." });
    if (!user.isActive) return reply.code(403).send({ error: "user_inactive", message: "Usuario inativo." });

    const passwordMatches = await verifyPassword(parsed.data.password, user.passwordHash, env);
    if (!passwordMatches) return reply.code(401).send({ error: "invalid_credentials", message: "Credenciais invalidas." });

    // Se 2FA habilitado — emite token temporário em vez de sessão
    if (user.totpEnabled && redis) {
      const twoFactorToken = randomUUID();

      if (user.totpMethod === "email") {
        if (!emailService) return reply.code(503).send({ error: "service_unavailable" });
        const otp = generateEmailOtp();
        const otpHash = hashEmailOtp(otp);
        await redis.set(
          `auth:2fa:pending:${twoFactorToken}`,
          JSON.stringify({ userId: user.id, method: "email", otpHash }),
          "EX", 300,
        );
        emailService.sendTwoFactorCode(user.email, user.login, otp).catch(() => {});
        return {
          authenticated: false,
          requires2fa: true,
          twoFactorToken,
          method: "email",
          ...(redirect.redirectUri ? { redirectUri: redirect.redirectUri } : {})
        };
      }

      await redis.set(
        `auth:2fa:pending:${twoFactorToken}`,
        JSON.stringify({ userId: user.id, method: "authenticator" }),
        "EX", 300,
      );
      return {
        authenticated: false,
        requires2fa: true,
        twoFactorToken,
        method: "authenticator",
        ...(redirect.redirectUri ? { redirectUri: redirect.redirectUri } : {})
      };
    }

    // Notificação de login apenas quando não há sessões ativas (primeira vez / todas expiradas)
    if (emailService && refreshTokens) {
      const activeCount = await users.countActiveRefreshTokens(user.id);
      if (activeCount === 0) {
        emailService.sendLoginNotification(user.email, user.login, clientIp(request), request.headers["user-agent"] ?? null).catch(() => {});
      }
    }

    await users.updateLastLogin(user.id);
    await issueTokens({
      user: { id: user.id, email: user.email, login: user.login, role: user.role },
      request, reply, env, sessions, refreshTokens,
    });

    return {
      authenticated: true,
      user: {
        id: user.id, email: user.email, login: user.login,
        role: user.role, createdAt: user.createdAt?.toISOString() ?? null,
        avatarUrl: user.avatarUrl,
      },
      ...(redirect.redirectUri ? { redirectUri: redirect.redirectUri } : {})
    };
  });

  server.post("/register", async (request, reply) => {
    const parsed = registerBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", message: "Dados de cadastro invalidos." });

    const redirect = await resolveOptionalRedirect(reply, authClients, parsed.data);
    if (redirect === "sent_error") return;

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const normalizedLogin = parsed.data.login.trim().toLowerCase();
    const existingUser = await users.findByIdentifier(normalizedEmail);
    const existingLogin = normalizedLogin === normalizedEmail ? existingUser : await users.findByIdentifier(normalizedLogin);

    if (existingUser || existingLogin) {
      return reply.code(409).send({ error: "user_exists", message: "Ja existe uma conta com este email ou login." });
    }

    if (parsed.data.provider && !isOAuthProvider(parsed.data.provider)) {
      return reply.code(400).send({ error: "invalid_provider", message: "Provedor de autenticacao invalido." });
    }

    if (parsed.data.provider && !parsed.data.externalAccountId) {
      return reply.code(400).send({ error: "missing_external_account", message: "Conta externa ausente." });
    }

    if (parsed.data.provider && !externalAccounts) {
      return reply.code(503).send({ error: "external_accounts_not_ready" });
    }

    const passwordHash = await createPasswordHash(parsed.data.password);
    let user;
    try {
      user = await users.createUser({ email: normalizedEmail, login: normalizedLogin, passwordHash });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "user_exists", message: "Ja existe uma conta com este email ou login." });
      }
      throw err;
    }

    const provider = parsed.data.provider as OAuthProvider | undefined;
    if (provider && parsed.data.externalAccountId && externalAccounts) {
      await externalAccounts.linkToUser({
        provider, externalAccountId: parsed.data.externalAccountId,
        email: normalizedEmail, displayName: parsed.data.displayName,
        avatarUrl: parsed.data.avatarUrl, userId: user.id
      });
    }

    await users.updateLastLogin(user.id);
    emailService?.sendWelcome(user.email, user.login).catch(() => {});
    await issueTokens({
      user: { id: user.id, email: user.email, login: user.login, role: user.role },
      request, reply, env, sessions, refreshTokens,
    });

    return {
      authenticated: true,
      user: {
        id: user.id, email: user.email, login: user.login,
        role: user.role, createdAt: user.createdAt?.toISOString() ?? null,
        avatarUrl: user.avatarUrl,
      },
      ...(redirect.redirectUri ? { redirectUri: redirect.redirectUri } : {})
    };
  });

  server.post("/password", async (request, reply) => {
    const parsed = setPasswordBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", message: "Senha invalida." });

    const redirect = await resolveOptionalRedirect(reply, authClients, parsed.data);
    if (redirect === "sent_error") return;

    const token = (request.cookies as Record<string, string>)[env.AUTH_COOKIE_NAME];
    const session = token ? await verifySessionToken(token, env) : null;
    if (!session) return reply.code(401).send({ error: "unauthorized", message: "Sessao invalida." });

    if (sessions && (!session.sessionId || !(await sessions.exists(session.sessionId)))) {
      return reply.code(401).send({ error: "unauthorized", message: "Sessao invalida." });
    }

    const user = await users.findById(session.userId);
    if (!user) return reply.code(401).send({ error: "unauthorized", message: "Sessao invalida." });

    const { needsPasswordSetup } = await import("./password");
    if (!needsPasswordSetup(user.passwordHash)) {
      if (!parsed.data.currentPassword) {
        return reply.code(400).send({ error: "current_password_required", message: "Informe a senha atual para alterá-la." });
      }
      const currentMatches = await verifyPassword(parsed.data.currentPassword, user.passwordHash, env);
      if (!currentMatches) {
        return reply.code(400).send({ error: "wrong_current_password", message: "Senha atual incorreta." });
      }
    }

    const passwordHash = await createPasswordHash(parsed.data.password);
    await users.updatePassword(session.userId, passwordHash);

    emailService?.sendPasswordChanged(user.email, user.login).catch(() => {});

    return { success: true, ...(redirect.redirectUri ? { redirectUri: redirect.redirectUri } : {}) };
  });

  // ─── Forgot / Reset password ─────────────────────────────────────────────

  server.post("/forgot-password", async (request, reply) => {
    const parsed = z.object({ email: z.string().trim().email() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });

    const user = await users.findByIdentifier(parsed.data.email).catch(() => null);
    if (!user) return reply.code(404).send({ error: "email_not_found", message: "Nenhuma conta encontrada com este e-mail." });

    if (!emailService || !redis) return reply.code(503).send({ error: "service_unavailable" });

    const token = randomUUID();
    await redis.set(`auth:reset:${token}`, JSON.stringify({ userId: user.id }), "EX", 900);

    const baseUrl = env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    emailService.sendPasswordReset(user.email, resetUrl).catch(() => {});

    return reply.code(200).send({ success: true });
  });

  server.post("/reset-password", async (request, reply) => {
    const parsed = z.object({
      token: z.string().min(1),
      password: z.string().min(8),
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", message: "Dados inválidos." });

    if (!redis) return reply.code(503).send({ error: "unavailable" });

    const redisKey = `auth:reset:${parsed.data.token}`;
    const raw = await redis.get(redisKey);
    if (!raw) return reply.code(400).send({ error: "invalid_token", message: "Token inválido ou expirado." });

    const { userId } = JSON.parse(raw) as { userId: number };
    const user = await users.findById(userId);
    if (!user) return reply.code(400).send({ error: "invalid_token" });

    const passwordHash = await createPasswordHash(parsed.data.password);
    await users.updatePassword(userId, passwordHash);
    await redis.del(redisKey);

    // Revoga todos os refresh tokens — session tokens no Redis expiram naturalmente
    if (refreshTokens) await refreshTokens.revokeAll(userId).catch(() => {});

    emailService?.sendPasswordChanged(user.email, user.login).catch(() => {});

    return { success: true };
  });

  // ─── 2FA verify-login (registrado aqui para ter acesso ao issueTokens) ────

  server.post("/2fa/verify-login", async (request, reply) => {
    const parsed = z.object({
      twoFactorToken: z.string().min(1),
      code: z.string().min(6).max(12),
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });

    if (!redis) return reply.code(503).send({ error: "2fa_unavailable" });

    const redisKey = `auth:2fa:pending:${parsed.data.twoFactorToken}`;
    const raw = await redis.get(redisKey);
    if (!raw) return reply.code(400).send({ error: "invalid_token", message: "Token 2FA expirado ou inválido." });

    const { userId, method = "authenticator", otpHash } = JSON.parse(raw) as {
      userId: number;
      method?: string;
      otpHash?: string;
    };
    const user = await users.findById(userId);
    if (!user || !user.totpEnabled) {
      return reply.code(400).send({ error: "invalid_token" });
    }

    let verified = false;
    const code = parsed.data.code.replace(/-/g, "");

    if (method === "email") {
      if (!otpHash) return reply.code(400).send({ error: "invalid_token" });
      const status = await consumeOtpAttempt(redis, redisKey);
      if (status === "locked") {
        return reply.code(429).send({ error: "too_many_attempts", message: "Muitas tentativas. Faça login novamente." });
      }
      verified = safeCompareHex(hashEmailOtp(code.slice(0, 6)), otpHash);
    } else {
      if (!user.totpSecret) return reply.code(400).send({ error: "invalid_token" });
      if (/^\d{6}$/.test(code)) {
        verified = verifyTotpCode(code, user.totpSecret);
      } else if (user.totpBackupCodes) {
        const result = verifyBackupCode(code, user.totpBackupCodes);
        if (result.valid) {
          await users.updateTotpBackupCodes(userId, result.remaining);
          verified = true;
        }
      }
    }

    if (!verified) {
      return reply.code(400).send({ error: "invalid_code", message: "Código inválido." });
    }

    await redis.del(redisKey);
    await users.updateLastLogin(userId);

    await issueTokens({
      user: { id: user.id, email: user.email, login: user.login, role: user.role },
      request, reply, env, sessions, refreshTokens,
    });

    return {
      authenticated: true,
      user: {
        id: user.id, email: user.email, login: user.login,
        role: user.role, createdAt: user.createdAt?.toISOString() ?? null,
        avatarUrl: user.avatarUrl,
      },
    };
  });

  // POST /2fa/email/resend — reenvia OTP de e-mail para login pendente
  server.post("/2fa/email/resend", async (request, reply) => {
    const body = z.object({ twoFactorToken: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request" });

    if (!redis) return reply.code(503).send({ error: "service_unavailable" });

    const redisKey = `auth:2fa:pending:${body.data.twoFactorToken}`;
    const [raw, ttl] = await Promise.all([redis.get(redisKey), redis.ttl(redisKey)]);
    if (!raw || ttl <= 0) return reply.code(400).send({ error: "invalid_token", message: "Token expirado." });

    const parsed = JSON.parse(raw) as {
      userId: number; method?: string; otpHash?: string;
      resendCount?: number; lastResend?: number;
    };
    if (parsed.method !== "email") return reply.code(400).send({ error: "wrong_method" });

    const resendCount = parsed.resendCount ?? 0;
    if (resendCount >= 3) {
      return reply.code(429).send({ error: "too_many_resends", message: "Limite de reenvios atingido." });
    }
    const now = Date.now();
    if (parsed.lastResend && (now - parsed.lastResend) < 30_000) {
      return reply.code(429).send({ error: "resend_too_soon", message: "Aguarde 30 segundos antes de reenviar." });
    }

    const user = await users.findById(parsed.userId);
    if (!user) return reply.code(400).send({ error: "invalid_token" });
    if (!emailService) return reply.code(503).send({ error: "service_unavailable" });

    const otp = generateEmailOtp();
    const otpHash = hashEmailOtp(otp);
    await redis.set(
      redisKey,
      JSON.stringify({ userId: parsed.userId, method: "email", otpHash, resendCount: resendCount + 1, lastResend: now }),
      "EX", ttl, // preserva TTL original
    );
    await redis.del(`${redisKey}:attempts`);
    emailService.sendTwoFactorCode(user.email, user.login, otp).catch(() => {});

    return { ok: true };
  });

  // ─── Alteração de e-mail ──────────────────────────────────────────────────

  // POST /change-email/request — solicita troca; envia e-mail de confirmação para o novo endereço
  server.post("/change-email/request", async (request, reply) => {
    const parsed = z.object({
      newEmail: z.string().trim().email(),
      password: z.string().min(1),
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });

    const token = (request.cookies as Record<string, string>)[env.AUTH_COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "unauthorized" });
    const session = await verifySessionToken(token, env);
    if (!session) return reply.code(401).send({ error: "unauthorized" });

    const user = await users.findById(session.userId);
    if (!user) return reply.code(401).send({ error: "unauthorized" });

    const ok = await verifyPassword(parsed.data.password, user.passwordHash, env as any);
    if (!ok) return reply.code(400).send({ error: "invalid_password", message: "Senha incorreta." });

    const normalizedNew = parsed.data.newEmail.toLowerCase();
    if (normalizedNew === user.email.toLowerCase()) {
      return reply.code(400).send({ error: "same_email", message: "O novo e-mail é igual ao atual." });
    }

    const existing = await users.findByIdentifier(normalizedNew).catch(() => null);
    if (existing) return reply.code(409).send({ error: "email_taken", message: "Este e-mail já está em uso." });

    if (!redis || !emailService) {
      return reply.code(503).send({ error: "service_unavailable" });
    }

    const confirmToken = randomUUID();
    const redisKey = `auth:email-change:${confirmToken}`;
    await redis.set(redisKey, JSON.stringify({ userId: user.id, newEmail: normalizedNew }), "EX", 60 * 30);

    const sgaWebBase = (env as any).SGA_WEB_URL ?? "https://prime.santos-games.com";
    const confirmUrl = `${sgaWebBase}/settings?confirm-email=${confirmToken}`;
    await emailService.sendEmailChangeConfirmation(normalizedNew, user.login, confirmUrl);

    return { success: true };
  });

  // POST /change-email/confirm — confirma a troca pelo token recebido no e-mail
  server.post("/change-email/confirm", async (request, reply) => {
    const parsed = z.object({ token: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });

    if (!redis) return reply.code(503).send({ error: "service_unavailable" });

    const redisKey = `auth:email-change:${parsed.data.token}`;
    const raw = await redis.get(redisKey);
    if (!raw) return reply.code(400).send({ error: "invalid_token", message: "Link expirado ou inválido." });

    const { userId, newEmail } = JSON.parse(raw) as { userId: number; newEmail: string };
    await redis.del(redisKey);
    await users.updateEmail(userId, newEmail);

    return { success: true, newEmail };
  });
}
