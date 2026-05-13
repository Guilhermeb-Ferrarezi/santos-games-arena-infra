import { MongoClient, type Document } from "mongodb";

export type HttpLogUser = {
  id: string | number;
  name?: string;
  email?: string;
  role?: string;
};

export type HttpLogRequest = {
  method: string;
  url: string;
  ip?: string;
  hostname?: string;
  protocol?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  params?: unknown;
  query?: unknown;
  routeOptions?: {
    url?: string;
  };
};

export type HttpLogReply = {
  statusCode: number;
  getHeader?(name: string): unknown;
};

export type HttpLogDocument = Document & {
  type: "http_request";
  occurredAt: string;
  method: string;
  url: string;
  path: string;
  route: string;
  statusCode: number;
  durationMs: number;
  ip?: string;
  hostname?: string;
  userAgent?: string;
  user?: HttpLogUser;
  requestBody?: unknown;
  responseBody?: unknown;
  request: {
    params?: unknown;
    query?: unknown;
    body?: unknown;
    headers: Record<string, unknown>;
  };
  response: {
    statusCode: number;
    body?: unknown;
  };
};

export type MongoHttpLoggingOptions = {
  mongoUrl?: string;
  dbName?: string;
  collectionName?: string;
  routeBlacklist?: string[];
  getRouteBlacklist?: string[];
  redactKeys?: string[];
  resolveUser?: (request: HttpLogRequest) => MaybePromise<HttpLogUser | null | undefined>;
};

export type HttpLoggingHookHost = {
  addHook: (name: string, handler: (...args: unknown[]) => unknown) => unknown;
};

type MaybePromise<T> = T | Promise<T>;

type RequestLogState = {
  startedAt: number;
  responseBody?: unknown;
};

const DEFAULT_DB_NAME = "logs";
const DEFAULT_REDACT_KEYS = ["password", "token", "secret", "authorization", "cookie", "session", "key"];
const DEFAULT_GET_ROUTE_BLACKLIST = ["/api/health", "/api/health/dependencies"];

const requestStates = new WeakMap<object, RequestLogState>();

export function registerMongoHttpLogging(
  server: HttpLoggingHookHost,
  options: MongoHttpLoggingOptions = {}
) {
  const writer = createMongoHttpLogWriter(options);

  server.addHook("onRequest", async (request: HttpLogRequest) => {
    requestStates.set(request as object, {
      startedAt: Date.now()
    });
  });

  server.addHook("onSend", async (request: HttpLogRequest, reply: HttpLogReply, payload: unknown) => {
    const state = requestStates.get(request as object);
    if (state) {
      state.responseBody = normalizeResponsePayload(payload, reply.getHeader?.("content-type"));
    }

    return payload;
  });

  server.addHook("onResponse", async (request: HttpLogRequest, reply: HttpLogReply) => {
    const state = requestStates.get(request as object);
    if (!state) {
      return;
    }

    requestStates.delete(request as object);

    const document = await buildHttpLogDocument(
      request,
      reply,
      state.startedAt,
      state.responseBody,
      options
    );

    if (!shouldPersistHttpLog(document, options)) {
      return;
    }

    await writer.insert(document);
  });

  server.addHook("onClose", async () => {
    await writer.close();
  });
}

export async function buildHttpLogDocument(
  request: HttpLogRequest,
  reply: HttpLogReply,
  startedAt: number,
  responseBody: unknown,
  options: Pick<MongoHttpLoggingOptions, "redactKeys" | "resolveUser"> = {}
): Promise<HttpLogDocument> {
  const occurredAt = new Date(startedAt).toISOString();
  const path = extractPath(request);
  const route = request.routeOptions?.url ?? path;
  const headers = sanitizeValue(request.headers ?? {}, options.redactKeys);
  const user = options.resolveUser ? await options.resolveUser(request) : undefined;

  return {
    type: "http_request",
    occurredAt,
    method: request.method,
    url: buildFullUrl(request),
    path,
    route,
    statusCode: reply.statusCode,
    durationMs: Math.max(0, Date.now() - startedAt),
    ip: request.ip,
    hostname: request.hostname,
    userAgent: getHeaderValue(headers, "user-agent"),
    user: user ?? undefined,
    requestBody: sanitizeValue(request.body, options.redactKeys),
    responseBody: sanitizeValue(responseBody, options.redactKeys),
    request: {
      params: sanitizeValue(request.params, options.redactKeys),
      query: sanitizeValue(request.query, options.redactKeys),
      body: sanitizeValue(request.body, options.redactKeys),
      headers: headers as Record<string, unknown>
    },
    response: {
      statusCode: reply.statusCode,
      body: sanitizeValue(responseBody, options.redactKeys)
    }
  };
}

export function shouldPersistHttpLog(
  document: Pick<HttpLogDocument, "method" | "path" | "route" | "statusCode">,
  options: Pick<MongoHttpLoggingOptions, "routeBlacklist" | "getRouteBlacklist"> = {}
) {
  const routeBlacklist = options.routeBlacklist ?? [];
  const getRouteBlacklist = options.getRouteBlacklist ?? DEFAULT_GET_ROUTE_BLACKLIST;
  const normalizedMethod = document.method.toUpperCase();
  const normalizedPath = document.path || document.route;

  if (matchesRouteBlacklist(normalizedPath, routeBlacklist)) {
    return false;
  }

  if (normalizedMethod === "GET" && matchesRouteBlacklist(normalizedPath, getRouteBlacklist)) {
    return false;
  }

  if (normalizedMethod === "GET") {
    return document.statusCode >= 400;
  }

  return ["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod) || document.statusCode >= 500;
}

export function sanitizeValue(value: unknown, redactKeys: string[] = DEFAULT_REDACT_KEYS): unknown {
  return sanitizeRecursive(value, new WeakSet(), redactKeys.map((item) => item.toLowerCase()));
}

function createMongoHttpLogWriter(options: MongoHttpLoggingOptions) {
  const mongoUrl = options.mongoUrl?.trim();
  const collectionName = options.collectionName?.trim();
  const dbName = options.dbName?.trim() || DEFAULT_DB_NAME;

  if (!mongoUrl || !collectionName) {
    return {
      async insert(_document: HttpLogDocument) {},
      async close() {}
    };
  }

  const client = new MongoClient(mongoUrl);
  let connectPromise: Promise<void> | null = null;

  async function getCollection() {
    if (!connectPromise) {
      connectPromise = client.connect().then(() => undefined);
    }

    await connectPromise;
    return client.db(dbName).collection<HttpLogDocument>(collectionName);
  }

  return {
    async insert(document: HttpLogDocument) {
      try {
        const collection = await getCollection();
        await collection.insertOne(document);
      } catch {
        // Logging must never block the API.
      }
    },
    async close() {
      try {
        await client.close();
      } catch {
        // Ignore close errors.
      }
    }
  };
}

function sanitizeRecursive(
  value: unknown,
  seen: WeakSet<object>,
  redactKeys: string[]
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function") {
    return "[REDACTED]";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof URL) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRecursive(item, seen, redactKeys));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[REDACTED]";
    }

    seen.add(value);
    const output: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (isSensitiveKey(key, redactKeys)) {
        output[key] = "[REDACTED]";
        continue;
      }

      output[key] = sanitizeRecursive(nestedValue, seen, redactKeys);
    }

    return output;
  }

  return String(value);
}

function isSensitiveKey(key: string, redactKeys: string[]) {
  const normalizedKey = key.toLowerCase();
  return redactKeys.some((needle) => normalizedKey.includes(needle));
}

function normalizeResponsePayload(payload: unknown, contentType?: unknown) {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === "string") {
    const contentTypeValue = normalizeHeaderValue(contentType);
    if (contentTypeValue.includes("application/json")) {
      return safeParseJson(payload);
    }

    return payload;
  }

  if (Buffer.isBuffer(payload)) {
    const text = payload.toString("utf8");
    const contentTypeValue = normalizeHeaderValue(contentType);
    if (contentTypeValue.includes("application/json")) {
      return safeParseJson(text);
    }

    return text;
  }

  return payload;
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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

function matchesRouteBlacklist(path: string, blacklist: string[]) {
  return blacklist.some((entry) => {
    const normalized = entry.trim();
    if (!normalized) {
      return false;
    }

    return path === normalized || path.startsWith(`${normalized}/`);
  });
}

function normalizeHeaderValue(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? "").toLowerCase();
  }

  return String(value ?? "").toLowerCase();
}

function getHeaderValue(headers: Record<string, unknown>, name: string) {
  const value = headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
