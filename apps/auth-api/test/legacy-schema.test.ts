import { describe, expect, test } from "bun:test";

import { legacyAuthSchema } from "../src/db/legacy-schema";

describe("legacyAuthSchema", () => {
  test("maps auth tables owned by the .NET migrations", () => {
    expect(legacyAuthSchema.platformUser.table).toBe("Platform_User");
    expect(legacyAuthSchema.platformUser.columns.email).toBe("email");
    expect(legacyAuthSchema.platformUser.uniqueIndexes).toEqual(["email", "login"]);

    expect(legacyAuthSchema.gameAccount.table).toBe("Game_Account");
    expect(legacyAuthSchema.gameAccount.uniqueIndexes).toEqual([
      "provider_external_account_id"
    ]);
  });
});
