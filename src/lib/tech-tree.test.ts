import { describe, expect, it } from "vitest";

import {
  challengeTierLabel,
  groupChallengesForTree,
  normalizeChallengeTier,
} from "./challenges";
import {
  calculateTotalWeightedScore,
  calculateWeightedScore,
  challengeTierWeight,
} from "./progress";

describe("티어 가중치 (T1=1, T2=1.25, T3=1.5)", () => {
  it("challengeTierWeight는 티어별 점수를 준다", () => {
    expect(challengeTierWeight(1)).toBe(1);
    expect(challengeTierWeight(2)).toBe(1.25);
    expect(challengeTierWeight(3)).toBe(1.5);
  });

  it("잘못된 티어는 T1로 정규화된다", () => {
    expect(normalizeChallengeTier(null)).toBe(1);
    expect(normalizeChallengeTier(0)).toBe(1);
    expect(normalizeChallengeTier("3")).toBe(3);
  });

  it("calculateWeightedScore는 tier가 있으면 level보다 tier를 우선한다", () => {
    // level=basic이지만 tier=3 → 1.5점이어야 함
    expect(calculateWeightedScore([{ level: "basic", tier: 3, completed: true }])).toBe(1.5);
    // tier 없으면 level 기준(아카이브 하위 호환)
    expect(calculateWeightedScore([{ level: "advanced", completed: true }])).toBe(1.25);
    expect(calculateWeightedScore([{ level: "advanced", tier: 1, completed: false }])).toBe(0);
  });

  it("만점 계산: T1 10 + T2 20 + T3 17 = 60.5점 (23기 트리)", () => {
    const challenges = [
      ...Array.from({ length: 10 }, () => ({ level: "basic" as const, tier: 1 })),
      ...Array.from({ length: 20 }, () => ({ level: "advanced" as const, tier: 2 })),
      ...Array.from({ length: 17 }, () => ({ level: "advanced" as const, tier: 3 })),
    ];
    expect(calculateTotalWeightedScore(challenges)).toBe(60.5);
  });
});

describe("티어 라벨", () => {
  it("티어별 한국어 라벨", () => {
    expect(challengeTierLabel(1)).toBe("기초 T1");
    expect(challengeTierLabel(2)).toBe("활용 T2");
    expect(challengeTierLabel(3)).toBe("심화 T3");
  });
});

describe("groupChallengesForTree", () => {
  const items = [
    { title: "설치", level: "basic", area: "start" },
    { title: "텔레그램", level: "basic", area: "channel" },
    { title: "크론잡", level: "basic", area: "automation" },
    { title: "브리핑", level: "advanced", area: "automation" },
  ];

  it("레벨 구분 없이 가지(area) 정의 순서로 묶고 빈 가지는 제외한다", () => {
    const groups = groupChallengesForTree(items);
    expect(groups.map((g) => g.key)).toEqual(["start", "channel", "automation"]);
    expect(groups[2].items.map((i) => i.title)).toEqual(["크론잡", "브리핑"]);
  });

  it("그룹 안에서 입력 순서(티어순 정렬 전제)를 유지한다", () => {
    const groups = groupChallengesForTree([...items].reverse());
    const automation = groups.find((g) => g.key === "automation");
    expect(automation?.items.map((i) => i.title)).toEqual(["브리핑", "크론잡"]);
  });
});
