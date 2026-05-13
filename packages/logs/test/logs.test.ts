import { describe, expect, test } from "bun:test";

import {
  sanitizeValue,
  shouldPersistHttpLog,
  type HttpLogDocument
} from "../src/index";

describe("@santos-games/logs", () => {
  test("redacts sensitive nested keys", () => {
    const value = sanitizeValue({
      password: "secret",
      token: "abc",
      profile: {
        email: "player@santos-games.com",
        apiKey: "key-123",
        nested: [{ authorization: "Bearer 123" }]
      }
    });

    expect(value).toEqual({
      password: "[REDACTED]",
      token: "[REDACTED]",
      profile: {
        email: "player@santos-games.com",
        apiKey: "[REDACTED]",
        nested: [{ authorization: "[REDACTED]" }]
      }
    });
  });

  test("persists mutating requests and get errors only", () => {
    const postDocument: Pick<HttpLogDocument, "method" | "path" | "route" | "statusCode"> = {
      method: "POST",
      path: "/api/login",
      route: "/api/login",
      statusCode: 200
    };
    const getOkDocument: Pick<HttpLogDocument, "method" | "path" | "route" | "statusCode"> = {
      method: "GET",
      path: "/api/session",
      route: "/api/session",
      statusCode: 200
    };
    const getErrorDocument: Pick<HttpLogDocument, "method" | "path" | "route" | "statusCode"> = {
      method: "GET",
      path: "/api/session",
      route: "/api/session",
      statusCode: 401
    };

    expect(shouldPersistHttpLog(postDocument)).toBe(true);
    expect(shouldPersistHttpLog(getOkDocument)).toBe(false);
    expect(shouldPersistHttpLog(getErrorDocument, { routeBlacklist: ["/api/session"] })).toBe(
      false
    );
    expect(shouldPersistHttpLog(getErrorDocument)).toBe(true);
  });
});
