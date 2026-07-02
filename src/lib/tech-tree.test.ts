import { describe, expect, it } from "vitest";

import {
  challengeTierLabel,
  groupChallengesForTree,
  normalizeChallengeTier,
} from "./challenges";
import { buildChallengeTree, countTreeNodes } from "./tech-tree";
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

  it("만점 계산: T1 10 + T2 21 + T3 15 = 58.75점 (23기 트리)", () => {
    const challenges = [
      ...Array.from({ length: 10 }, () => ({ level: "basic" as const, tier: 1 })),
      ...Array.from({ length: 21 }, () => ({ level: "advanced" as const, tier: 2 })),
      ...Array.from({ length: 15 }, () => ({ level: "advanced" as const, tier: 3 })),
    ];
    expect(calculateTotalWeightedScore(challenges)).toBe(58.75);
  });
});

describe("티어 라벨", () => {
  it("티어별 한국어 라벨", () => {
    expect(challengeTierLabel(1)).toBe("기초 T1");
    expect(challengeTierLabel(2)).toBe("활용 T2");
    expect(challengeTierLabel(3)).toBe("심화 T3");
  });
});

describe("buildChallengeTree", () => {
  const items = [
    { id: "install", prerequisiteId: null, tier: 1 },
    { id: "telegram", prerequisiteId: "install", tier: 1 },
    { id: "cron", prerequisiteId: "telegram", tier: 1 },
    { id: "briefing", prerequisiteId: "cron", tier: 2 },
    { id: "salon", prerequisiteId: "bot2bot", tier: 3 }, // 고아(bot2bot 없음)
  ];

  it("prerequisite 사슬로 트리를 만들고 자식은 tier 오름차순으로 정렬한다", () => {
    const roots = buildChallengeTree([
      { id: "r", prerequisiteId: null, tier: 1 },
      { id: "t3", prerequisiteId: "r", tier: 3 },
      { id: "t1", prerequisiteId: "r", tier: 1 },
    ]);
    expect(roots).toHaveLength(1);
    expect(roots[0].children.map((c) => c.item.id)).toEqual(["t1", "t3"]);
  });

  it("체인이 깊이로 이어진다 (install → telegram → cron → briefing)", () => {
    const roots = buildChallengeTree(items);
    const install = roots.find((r) => r.item.id === "install")!;
    expect(install.children[0].item.id).toBe("telegram");
    expect(install.children[0].children[0].item.id).toBe("cron");
    expect(install.children[0].children[0].children[0].item.id).toBe("briefing");
  });

  it("선행 id가 목록에 없는 고아는 뿌리로 승격되어 화면에서 사라지지 않는다", () => {
    const roots = buildChallengeTree(items);
    expect(roots.map((r) => r.item.id).sort()).toEqual(["install", "salon"]);
    expect(countTreeNodes(roots)).toBe(items.length);
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
