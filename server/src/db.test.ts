import { describe, expect, it } from "vitest";

import { createDatabase } from "./db.mjs";

describe("database pool configuration", () => {
  it("sets statement timeout in connection parameters without a connect-handler query", async () => {
    const pool = createDatabase({
      DB_HOST: "127.0.0.1",
      DB_PORT: 5432,
      DB_NAME: "test",
      DB_USER: "test",
      DB_PASSWORD: "test",
    });
    expect(pool.options.statement_timeout).toBe(5_000);
    expect(pool.listenerCount("connect")).toBe(0);
    await pool.end();
  });
});
