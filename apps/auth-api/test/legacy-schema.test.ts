import { describe, expect, test } from "bun:test";

import { legacyAuthSchema } from "../src/db/legacy-schema";

describe("legacyAuthSchema", () => {
  test("maps auth tables owned by the .NET migrations", () => {
    expect(legacyAuthSchema.user.table).toBe("User");
    expect(legacyAuthSchema.user.columns.email).toBe("email");
    expect(legacyAuthSchema.user.columns.role).toBe("role");
    expect(legacyAuthSchema.user.uniqueIndexes).toEqual(["email", "login"]);

    expect(legacyAuthSchema.gameAccount.table).toBe("Game_Account");
    expect(legacyAuthSchema.gameAccount.uniqueIndexes).toEqual([
      "provider_external_account_id"
    ]);
  });
});
