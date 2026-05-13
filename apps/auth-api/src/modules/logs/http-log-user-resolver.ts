import type { HttpLogRequest, HttpLogUser } from "@santos-games/logs";

import type { AuthApiEnv } from "../../../config/env";
import { verifySessionToken } from "../session/session-token";
import type { SessionStore } from "../session/session-store";
import type { PlatformUserRepository } from "../users/platform-user-repository";

export function createHttpLogUserResolver(
  env: Pick<AuthApiEnv, "AUTH_COOKIE_NAME" | "JWT_SECRET">,
  users?: PlatformUserRepository,
  sessions?: SessionStore
) {
  return async (request: HttpLogRequest): Promise<HttpLogUser | null> => {
    if (!users) {
      return null;
    }

    const token = getCookieValue(request.headers?.cookie, env.AUTH_COOKIE_NAME);
    if (!token) {
      return null;
    }

    const session = await verifySessionToken(token, env);
    if (!session) {
      return null;
    }

    if (sessions && (!session.sessionId || !(await sessions.exists(session.sessionId)))) {
      return null;
    }

    const user = await users.findById(session.userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.login,
      email: user.email,
      role: user.isActive ? "platform_user" : "inactive"
    };
  };
}

function getCookieValue(
  cookieHeader: string | string[] | undefined,
  cookieName: string
) {
  const header = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.split("=");
    if (rawKey.trim() !== cookieName) {
      continue;
    }

    return decodeURIComponent(rawValue.join("=").trim());
  }

  return null;
}
