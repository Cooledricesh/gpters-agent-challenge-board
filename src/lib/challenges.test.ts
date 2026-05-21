import { describe, expect, it } from "vitest";

import { groupChallengesByLevel, normalizeChallengeLevel, normalizeChallengeUpdateInput } from "./challenges";

describe("challenge level helpers", () => {
  it("normalizes unknown or missing levels to basic", () => {
    expect(normalizeChallengeLevel("basic")).toBe("basic");
    expect(normalizeChallengeLevel("advanced")).toBe("advanced");
    expect(normalizeChallengeLevel(null)).toBe("basic");
    expect(normalizeChallengeLevel("other")).toBe("basic");
  });

  it("groups challenges into basic and advanced while preserving each group order", () => {
    const grouped = groupChallengesByLevel([
      { id: "1", title: "기본 1", level: "basic" },
      { id: "2", title: "고급 1", level: "advanced" },
      { id: "3", title: "기본 2", level: null },
      { id: "4", title: "고급 2", level: "advanced" },
    ]);

    expect(grouped.basic.map((item) => item.id)).toEqual(["1", "3"]);
    expect(grouped.advanced.map((item) => item.id)).toEqual(["2", "4"]);
  });

  it("normalizes editable challenge fields for update requests", () => {
    expect(
      normalizeChallengeUpdateInput({
        title: "  긴 프롬프트 실습  ",
        description: "  보드용 요약  ",
        detail: "  수행 방법\n완료 기준  ",
        level: "advanced",
      }),
    ).toEqual({
      title: "긴 프롬프트 실습",
      description: "보드용 요약",
      detail: "수행 방법\n완료 기준",
      level: "advanced",
    });

    expect(
      normalizeChallengeUpdateInput({
        title: "제목만 수정",
        description: "   ",
        detail: "",
        level: "unknown",
      }),
    ).toEqual({
      title: "제목만 수정",
      description: null,
      detail: null,
      level: "basic",
    });
  });
});
