import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthApiEnv } from "../../config/env";
import type { PlatformUserRepository } from "../users/platform-user-repository";
import type { RefreshTokenRepository } from "../session/refresh-token-repository";
import type { SessionStore } from "../session/session-store";
import type { EmailService } from "../email/email-service";
import { verifySessionToken } from "../session/session-token";
import { verifyPassword } from "../auth/password";
import {
  generateTotpSecret, getTotpUri, verifyTotpCode,
  generateBackupCodes, hashBackupCode, verifyBackupCode,
  generateEmailOtp, hashEmailOtp, maskEmail, safeCompareHex, consumeOtpAttempt,
} from "./totp";

type Env = Pick<AuthApiEnv, "AUTH_COOKIE_NAME" | "JWT_SECRET">;

async function getAuthedUser(
  request: Parameters<Parameters<FastifyInstance["get"]>[1]>[0],
  env: Env,
  users: PlatformUserRepository,
  sessions?: SessionStore,
) {
  const token = (request.cookies as Record<string, string>)[env.AUTH_COOKIE_NAME];
  if (!token) return null;
  const session = await verifySessionToken(token, env);
  if (!session) return null;
  if (sessions && session.sessionId && !(await sessions.exists(session.sessionId))) return null;
  return users.findById(session.userId);
}

export function registerTotpRoutes(
  server: FastifyInstance,
  env: Env,
  users: PlatformUserRepository,
  sessions?: SessionStore,
  refreshTokens?: RefreshTokenRepository,
  emailService?: EmailService,
  redis?: import("ioredis").Redis,
) {
  // GET /2fa/setup?method=authenticator|email
  server.get("/2fa/setup", async (request, reply) => {
    const { method = "authenticator" } = request.query as { method?: string };

    const user = await getAuthedUser(request, env, users, sessions);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    if (user.totpEnabled) return reply.code(409).send({ error: "2fa_already_enabled" });

    if (method === "email") {
      return { method: "email", email: maskEmail(user.email) };
    }

    const secret = generateTotpSecret();
    const otpauthUrl = getTotpUri(secret, user.login);
    return { method: "authenticator", secret, otpauthUrl };
  });

  // POST /2fa/enable — confirma código e habilita 2FA via autenticador
  server.post("/2fa/enable", async (request, reply) => {
    const body = z.object({ secret: z.string().min(1), code: z.string().length(6) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request" });

    const user = await getAuthedUser(request, env, users, sessions);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    if (user.totpEnabled) return reply.code(409).send({ error: "2fa_already_enabled" });

    if (!verifyTotpCode(body.data.code, body.data.secret)) {
      return reply.code(400).send({ error: "invalid_code", message: "Código TOTP inválido." });
    }

    const backupCodes = generateBackupCodes();
    const hashes = backupCodes.map(hashBackupCode);
    await users.enableTotp(user.id, body.data.secret, hashes);

    return { success: true, backupCodes };
  });

  // POST /2fa/email/send-code — envia OTP para o e-mail do usuário (setup)
  server.post("/2fa/email/send-code", async (request, reply) => {
    const user = await getAuthedUser(request, env, users, sessions);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    if (user.totpEnabled) return reply.code(409).send({ error: "2fa_already_enabled" });
    if (!redis || !emailService) return reply.code(503).send({ error: "service_unavailable" });

    const otpKey = `auth:2fa:setup:email:${user.id}`;
    const existingTtl = await redis.ttl(otpKey);
    if (existingTtl > 570) {
      return reply.code(429).send({ error: "send_too_soon", message: "Aguarde 30 segundos antes de solicitar um novo código." });
    }

    const otp = generateEmailOtp();
    const otpHash = hashEmailOtp(otp);
    await redis.set(otpKey, otpHash, "EX", 600);
    await redis.del(`${otpKey}:attempts`);
    emailService.sendTwoFactorCode(user.email, user.login, otp).catch(() => {});

    return { ok: true, email: maskEmail(user.email) };
  });

  // POST /2fa/email/confirm — verifica OTP e habilita 2FA por e-mail
  server.post("/2fa/email/confirm", async (request, reply) => {
    const body = z.object({ code: z.string().length(6) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request" });

    const user = await getAuthedUser(request, env, users, sessions);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    if (user.totpEnabled) return reply.code(409).send({ error: "2fa_already_enabled" });
    if (!redis) return reply.code(503).send({ error: "service_unavailable" });

    const otpKey = `auth:2fa:setup:email:${user.id}`;
    const storedHash = await redis.get(otpKey);
    if (!storedHash) return reply.code(400).send({ error: "code_expired", message: "Código expirado. Solicite um novo." });

    const status = await consumeOtpAttempt(redis, otpKey);
    if (status === "locked") {
      return reply.code(429).send({ error: "too_many_attempts", message: "Muitas tentativas. Solicite um novo código." });
    }

    if (!safeCompareHex(hashEmailOtp(body.data.code), storedHash)) {
      return reply.code(400).send({ error: "invalid_code", message: "Código inválido." });
    }

    await redis.del(otpKey, `${otpKey}:attempts`);
    await users.enableTotpEmail(user.id);

    return { success: true };
  });

  // POST /2fa/disable — desabilita 2FA via código (TOTP ou OTP de e-mail)
  server.post("/2fa/disable", async (request, reply) => {
    const body = z.object({ code: z.string().min(6) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request", message: "Informe o código." });

    const user = await getAuthedUser(request, env, users, sessions);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    if (!user.totpEnabled) return reply.code(409).send({ error: "2fa_not_enabled" });

    const { code } = body.data;
    let verified = false;

    if (user.totpMethod === "authenticator" && user.totpSecret) {
      verified = verifyTotpCode(code, user.totpSecret);
      if (!verified && user.totpBackupCodes) {
        const result = verifyBackupCode(code, user.totpBackupCodes);
        if (result.valid) {
          await users.updateTotpBackupCodes(user.id, result.remaining);
          verified = true;
        }
      }
    } else if (user.totpMethod === "email" && redis) {
      const disableKey = `auth:2fa:disable:email:${user.id}`;
      const storedHash = await redis.get(disableKey);
      if (!storedHash) {
        return reply.code(400).send({ error: "no_code_sent", message: "Solicite o código de desativação primeiro." });
      }
      const status = await consumeOtpAttempt(redis, disableKey);
      if (status === "locked") {
        return reply.code(429).send({ error: "too_many_attempts", message: "Muitas tentativas. Solicite um novo código." });
      }
      if (safeCompareHex(hashEmailOtp(code), storedHash)) {
        await redis.del(disableKey, `${disableKey}:attempts`);
        verified = true;
      }
    }

    if (!verified) {
      return reply.code(400).send({ error: "invalid_code", message: "Código inválido." });
    }

    await users.disableTotp(user.id);
    return { success: true };
  });

  // POST /2fa/email/send-disable-code — envia OTP para desabilitar 2FA por e-mail
  server.post("/2fa/email/send-disable-code", async (request, reply) => {
    const user = await getAuthedUser(request, env, users, sessions);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    if (!user.totpEnabled || user.totpMethod !== "email") {
      return reply.code(409).send({ error: "not_email_2fa" });
    }
    if (!redis || !emailService) return reply.code(503).send({ error: "service_unavailable" });

    const disableKey = `auth:2fa:disable:email:${user.id}`;
    const existingTtl = await redis.ttl(disableKey);
    if (existingTtl > 570) {
      return reply.code(429).send({ error: "send_too_soon", message: "Aguarde 30 segundos antes de solicitar um novo código." });
    }

    const otp = generateEmailOtp();
    const otpHash = hashEmailOtp(otp);
    await redis.set(disableKey, otpHash, "EX", 600);
    await redis.del(`${disableKey}:attempts`);
    emailService.sendTwoFactorCode(user.email, user.login, otp).catch(() => {});

    return { ok: true, email: maskEmail(user.email) };
  });
}
