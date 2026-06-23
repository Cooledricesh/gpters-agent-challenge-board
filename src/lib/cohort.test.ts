import { describe, expect, it } from "vitest";

import { CURRENT_COHORT, ARCHIVED_COHORTS } from "./cohort";

describe("cohort 설정", () => {
  it("현재 기수는 23기다", () => {
    expect(CURRENT_COHORT).toBe("23기");
  });

  it("22기는 아카이브로 보존된다", () => {
    expect(ARCHIVED_COHORTS).toContain("22");
  });
});
