import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthApiEnv } from "../../config/env";
import type { PlatformUserRepository } from "../users/platform-user-repository";
import type { RefreshTokenRepository } from "../session/refresh-token-repository";
import type { SessionStore } from "../session/session-store";
import { verifySessionToken } from "../session/session-token";
import { verifyPassword } from "../auth/password";
import {
  generateTotpSecret, getTotpUri, verifyTotpCode,
  generateBackupCodes, hashBackupCode, verifyBackupCode,
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
) {
  // GET /2fa/setup — gera secret e URI para QR code
  server.get("/2fa/setup", async (request, reply) => {
    const user = await getAuthedUser(request, env, users, sessions);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    if (user.totpEnabled) return reply.code(409).send({ error: "2fa_already_enabled" });

    const secret = generateTotpSecret();
    const otpauthUrl = getTotpUri(secret, user.login);

    return { secret, otpauthUrl };
  });

  // POST /2fa/enable — confirma código e habilita 2FA
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

  // POST /2fa/disable — desabilita 2FA (exige código TOTP ou senha)
  server.post("/2fa/disable", async (request, reply) => {
    const body = z.object({
      code: z.string().optional(),
      password: z.string().optional(),
    }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request" });

    const user = await getAuthedUser(request, env, users, sessions);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    if (!user.totpEnabled) return reply.code(409).send({ error: "2fa_not_enabled" });

    const { code, password } = body.data;

    if (code && user.totpSecret) {
      if (!verifyTotpCode(code, user.totpSecret)) {
        return reply.code(400).send({ error: "invalid_code", message: "Código TOTP inválido." });
      }
    } else if (password) {
      const ok = await verifyPassword(password, user.passwordHash, env as any);
      if (!ok) return reply.code(400).send({ error: "invalid_password", message: "Senha incorreta." });
    } else {
      return reply.code(400).send({ error: "missing_verification", message: "Informe o código TOTP ou a senha." });
    }

    await users.disableTotp(user.id);
    return { success: true };
  });

  // POST /2fa/verify-login — verifica código TOTP durante fluxo de login
  server.post("/2fa/verify-login", async (request, reply) => {
    const body = z.object({
      twoFactorToken: z.string().min(1),
      code: z.string().min(6).max(8),
    }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_request" });

    // O token temporário fica no Redis com key auth:2fa:pending:{token}
    const redis = (server as any)._2faRedis as import("ioredis").Redis | undefined;
    if (!redis) return reply.code(503).send({ error: "2fa_unavailable" });

    const redisKey = `auth:2fa:pending:${body.data.twoFactorToken}`;
    const raw = await redis.get(redisKey);
    if (!raw) return reply.code(400).send({ error: "invalid_token", message: "Token 2FA expirado ou inválido." });

    const { userId } = JSON.parse(raw) as { userId: number };
    const user = await users.findById(userId);
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return reply.code(400).send({ error: "invalid_token" });
    }

    // Aceita tanto código TOTP (6 dígitos) quanto backup code
    let verified = false;
    if (/^\d{6}$/.test(body.data.code)) {
      verified = verifyTotpCode(body.data.code, user.totpSecret);
    } else if (user.totpBackupCodes) {
      const { valid, remaining } = verifyBackupCode(body.data.code, user.totpBackupCodes);
      if (valid) {
        await users.updateTotpBackupCodes(userId, remaining);
        verified = true;
      }
    }

    if (!verified) {
      return reply.code(400).send({ error: "invalid_code", message: "Código inválido." });
    }

    await redis.del(redisKey);

    // Emite sessão via callback registrado no server
    const issueSession = (server as any)._issueSessionForUser as
      | ((userId: number, request: typeof request, reply: typeof reply) => Promise<object>)
      | undefined;

    if (issueSession) {
      const result = await issueSession(userId, request, reply);
      return result;
    }

    return reply.code(503).send({ error: "session_unavailable" });
  });
}
