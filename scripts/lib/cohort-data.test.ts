import { afterEach, describe, expect, it } from "vitest";

import { makeServiceClient } from "./cohort-data.mjs";

const originalBackend = process.env.DATA_BACKEND;

afterEach(() => {
  if (originalBackend === undefined) delete process.env.DATA_BACKEND;
  else process.env.DATA_BACKEND = originalBackend;
});

describe("cohort script backend guard", () => {
  it("rejects NAS backend", () => {
    process.env.DATA_BACKEND = "nas";
    expect(() => makeServiceClient()).toThrow("DATA_BACKEND=nas");
  });
});
