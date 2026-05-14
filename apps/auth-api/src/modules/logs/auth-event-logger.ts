import type { HttpLogRequest } from "@santos-games/logs";
import { createMongoDocumentWriter } from "@santos-games/logs";

import type { AuthApiEnv } from "../../../config/env";
import type { OAuthProvider } from "../oauth/providers";
import type { PlatformUser } from "../users/platform-user-repository";

export type AuthEventName = "oauth_login" | "oauth_register";

export type AuthEventDocument = {
  type: "auth_event";
  occurredAt: string;
  event: AuthEventName;
  provider: OAuthProvider;
  success: true;
  method: "AUTH";
  url: string;
  path: string;
  route: string;
  statusCode: number;
  durationMs: number;
  ip?: string;
  hostname?: string;
  userAgent?: string;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  request: {
    params?: unknown;
    query?: unknown;
    body?: unknown;
    headers: Record<string, unknown>;
  };
  response: {
    statusCode: number;
    body: {
      event: AuthEventName;
      provider: OAuthProvider;
      success: true;
    };
  };
};

export type AuthEventLogger = {
  record(event: AuthEventInput): Promise<void>;
  close(): Promise<void>;
};

export type AuthEventInput = {
  request: HttpLogRequest;
  startedAt: number;
  event: AuthEventName;
  provider: OAuthProvider;
  user: PlatformUser;
  statusCode?: number;
};

export function createAuthEventLogger(
  env: Pick<AuthApiEnv, "LOGS_MONGO_URL" | "LOGS_MONGO_DB_NAME" | "LOGS_HTTP_COLLECTION">
): AuthEventLogger {
  const writer = createMongoDocumentWriter<AuthEventDocument>({
    mongoUrl: env.LOGS_MONGO_URL,
    dbName: env.LOGS_MONGO_DB_NAME,
    collectionName: env.LOGS_HTTP_COLLECTION
  });

  return {
    async record(input) {
      const document: AuthEventDocument = {
        type: "auth_event",
        occurredAt: new Date(input.startedAt).toISOString(),
        event: input.event,
        provider: input.provider,
        success: true,
        method: "AUTH",
        url: buildFullUrl(input.request),
        path: extractPath(input.request),
        route: input.request.routeOptions?.url ?? extractPath(input.request),
        statusCode: input.statusCode ?? 200,
        durationMs: Math.max(0, Date.now() - input.startedAt),
        ip: input.request.ip,
        hostname: input.request.hostname,
        userAgent: getHeaderValue(input.request.headers ?? {}, "user-agent"),
        user: {
          id: input.user.id,
          name: input.user.login,
          email: input.user.email,
          role: "platform_user"
        },
        request: {
          params: input.request.params,
          query: input.request.query,
          body: input.request.body,
          headers: sanitizeHeaders(input.request.headers)
        },
        response: {
          statusCode: input.statusCode ?? 200,
          body: {
            event: input.event,
            provider: input.provider,
            success: true
          }
        }
      };

      await writer.insert(document);
    },
    async close() {
      await writer.close();
    }
  };
}

function buildFullUrl(request: HttpLogRequest) {
  const protocol = request.protocol?.replace(/:$/, "") || "http";
  const host = request.hostname || getHeaderValue(request.headers ?? {}, "host") || "localhost";
  return new URL(request.url, `${protocol}://${host}`).toString();
}

function extractPath(request: HttpLogRequest) {
  try {
    return new URL(request.url, "http://localhost").pathname;
  } catch {
    return request.url.split("?")[0] || "/";
  }
}

function sanitizeHeaders(headers?: Record<string, string | string[] | undefined>) {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(headers ?? {})) {
    const lowerKey = key.toLowerCase();
    if (["authorization", "cookie", "password", "token", "secret", "session", "key"].some((needle) => lowerKey.includes(needle))) {
      output[key] = "[REDACTED]";
      continue;
    }

    output[key] = value;
  }

  return output;
}

function getHeaderValue(headers: Record<string, string | string[] | undefined>, name: string) {
  const value = headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
