import type { FastifyInstance } from "fastify";

import type { AuthApiEnv } from "../../../config/env";
import { buildOAuthAuthorizationUrl, isOAuthProvider } from "./providers";
import type { ExternalAuthAccountRepository } from "./external-auth-account-repository";
import type { OAuthClient, OAuthProfile } from "./oauth-client";
import { createOAuthState, readOAuthState } from "./oauth-state";
import { createSessionToken } from "../session/session-token";
import { createSessionId, type SessionStore } from "../session/session-store";
import type { OAuthProvider } from "./providers";
import type { PlatformUserRepository } from "../users/platform-user-repository";
import { needsPasswordSetup } from "../auth/password";

export function registerOAuthRoutes(
  server: FastifyInstance,
  env: Pick<
    AuthApiEnv,
    | "AUTH_PUBLIC_URL"
    | "AUTH_COOKIE_DOMAIN"
    | "AUTH_COOKIE_NAME"
    | "DISCORD_CLIENT_ID"
    | "GOOGLE_CLIENT_ID"
    | "JWT_SECRET"
    | "NODE_ENV"
    | "OAUTH_STATE_TTL_SECONDS"
    | "SESSION_TTL_SECONDS"
    | "STEAM_API_KEY"
  >,
  dependencies?: {
    externalAccounts?: ExternalAuthAccountRepository;
    oauthClient?: OAuthClient;
    sessions?: SessionStore;
    users?: PlatformUserRepository;
  }
) {
  server.get("/oauth/:provider/start", async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const query = request.query as { returnTo?: string; entry?: string };

    if (!isOAuthProvider(provider)) {
      return reply.code(404).send({
        error: "provider_not_found",
        message: "Provedor de autenticacao nao encontrado."
      });
    }

    const entry = query.entry === "login" || query.entry === "register" ? query.entry : undefined;
    const state = await createOAuthState(provider, env, query.returnTo, entry);

    try {
      return reply.redirect(buildOAuthAuthorizationUrl(provider, env, state));
    } catch {
      return reply.code(503).send({
        error: "provider_not_configured",
        message: "Provedor de autenticacao nao configurado."
      });
    }
  });

  server.get("/oauth/:provider/callback", async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const query = request.query as Record<string, string | string[] | undefined>;

    if (!isOAuthProvider(provider)) {
      return reply.code(404).send({
        error: "provider_not_found",
        message: "Provedor de autenticacao nao encontrado."
      });
    }

    const oauthState = await readOAuthStateFromCallback(provider, query, env);
    if (!oauthState) {
      return reply.code(401).send({
        error: "invalid_oauth_state",
        message: "Estado OAuth invalido."
      });
    }

    if (provider !== "steam" && !getSingleQueryValue(query, "code")) {
      return reply.code(400).send({
        error: "missing_oauth_code",
        message: "Codigo OAuth ausente."
      });
    }

    if (!dependencies?.externalAccounts || !dependencies.oauthClient || !dependencies.users) {
      return reply.code(503).send({
        error: "oauth_not_ready",
        message: "OAuth nao esta pronto neste ambiente."
      });
    }

    let profile: OAuthProfile;
    try {
      profile =
        provider === "steam"
          ? await dependencies.oauthClient.exchangeSteamOpenId(query)
          : await dependencies.oauthClient.exchangeCodeForProfile(
              provider,
              getSingleQueryValue(query, "code") ?? ""
            );
    } catch {
      return reply.code(401).send({
        error: "invalid_oauth_response",
        message: "Resposta OAuth invalida."
      });
    }
    let user = await dependencies.externalAccounts.findLinkedUser(
      provider,
      profile.externalAccountId
    );

    if (!user) {
      if (oauthState.entry === "register") {
        const existingUserByEmail = await dependencies.users.findByIdentifier(profile.email);
        const existingUserByLogin =
          profile.login === profile.email
            ? existingUserByEmail
            : await dependencies.users.findByIdentifier(profile.login);

        if (existingUserByEmail || existingUserByLogin) {
          return reply.redirect(buildLoginUrl(env, "Já existe uma conta com este email ou usuário. Use login."));
        }

        user = await dependencies.users.createOAuthUser({
          email: profile.email,
          login: profile.login,
          provider,
          externalAccountId: profile.externalAccountId
        });

        await dependencies.externalAccounts.linkToUser({
          provider,
          externalAccountId: profile.externalAccountId,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          userId: user.id
        });

        await dependencies.users.updateLastLogin(user.id);

        const sessionId = createSessionId();
        if (dependencies.sessions) {
          await dependencies.sessions.create({
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

        return reply.redirect(buildPasswordSetupUrl(env, oauthState.returnTo, profile));
      }

      return reply.redirect(
        buildRegisterUrl(env, oauthState.returnTo, profile, providerLabel(provider))
      );
    }

    if (!user.isActive) {
      return reply.code(403).send({
        error: "user_inactive",
        message: "Usuario inativo."
      });
    }

    if (needsPasswordSetup(user.passwordHash)) {
      await dependencies.users.updateLastLogin(user.id);

      const sessionId = createSessionId();
      if (dependencies.sessions) {
        await dependencies.sessions.create({
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

      return reply.redirect(
        buildPasswordSetupUrl(env, oauthState.returnTo, {
          provider,
          externalAccountId: profile.externalAccountId,
          email: user.email,
          login: user.login,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl
        })
      );
    }

    await dependencies.users.updateLastLogin(user.id);

    const sessionId = createSessionId();
    if (dependencies.sessions) {
      await dependencies.sessions.create({
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

    return reply.redirect(oauthState.returnTo);
  });
}

async function readOAuthStateFromCallback(
  provider: OAuthProvider,
  query: Record<string, string | string[] | undefined>,
  env: Pick<AuthApiEnv, "JWT_SECRET">
) {
  if (provider === "steam") {
    const returnTo = getSingleQueryValue(query, "openid.return_to");
    let state: string | null = null;

    if (returnTo) {
      try {
        state = new URL(returnTo).searchParams.get("state");
      } catch {
        state = null;
      }
    }

    if (!state) {
      return null;
    }

    return readOAuthState(state, provider, env);
  }

  const state = getSingleQueryValue(query, "state");
  return state ? readOAuthState(state, provider, env) : null;
}

function getSingleQueryValue(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === "string" ? value : undefined;
}

function buildPasswordSetupUrl(
  env: Pick<AuthApiEnv, "AUTH_PUBLIC_URL">,
  returnTo: string,
  profile: {
    provider: OAuthProvider;
    externalAccountId: string;
    email: string;
    login: string;
    displayName?: string;
    avatarUrl?: string;
  }
) {
  const url = new URL("/set-password", resolvePublicUrl(env));
  url.searchParams.set("provider", profile.provider);
  url.searchParams.set("email", profile.email);
  url.searchParams.set("login", profile.login);
  url.searchParams.set("returnTo", returnTo);
  url.searchParams.set(
    "toast",
    `Sua conta com ${providerLabel(profile.provider)} ainda nao tem senha. Defina uma senha para continuar.`
  );

  if (profile.displayName) {
    url.searchParams.set("displayName", profile.displayName);
  }

  if (profile.avatarUrl) {
    url.searchParams.set("avatarUrl", profile.avatarUrl);
  }

  return url.toString();
}

function buildLoginUrl(
  env: Pick<AuthApiEnv, "AUTH_PUBLIC_URL">,
  toast?: string
) {
  const url = new URL("/", resolvePublicUrl(env));

  if (toast) {
    url.searchParams.set("toast", toast);
  }

  return url.toString();
}

function buildRegisterUrl(
  env: Pick<AuthApiEnv, "AUTH_PUBLIC_URL">,
  returnTo: string,
  profile: {
    provider: OAuthProvider;
    email: string;
    login: string;
    displayName?: string;
    avatarUrl?: string;
  },
  providerName?: string | null
) {
  const url = new URL("/register", resolvePublicUrl(env));
  url.searchParams.set("returnTo", returnTo);
  url.searchParams.set("provider", profile.provider);
  url.searchParams.set("email", profile.email);
  url.searchParams.set("login", profile.login);

  if (profile.displayName) {
    url.searchParams.set("displayName", profile.displayName);
  }

  if (profile.avatarUrl) {
    url.searchParams.set("avatarUrl", profile.avatarUrl);
  }

  url.searchParams.set(
    "toast",
    providerName
      ? `Nenhuma conta vinculada ao ${providerName}. Crie sua conta para continuar.`
      : "Nenhuma conta vinculada. Crie sua conta para continuar."
  );

  return url.toString();
}

function providerLabel(provider: OAuthProvider) {
  if (provider === "google") {
    return "Google";
  }

  if (provider === "discord") {
    return "Discord";
  }

  return "Steam";
}

function resolvePublicUrl(env: Pick<AuthApiEnv, "AUTH_PUBLIC_URL">) {
  return (env.AUTH_PUBLIC_URL ?? "http://localhost:3001").replace(/\/+$/, "");
}
