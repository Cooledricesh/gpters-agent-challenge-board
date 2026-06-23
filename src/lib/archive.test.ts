import { describe, expect, it } from "vitest";

import { toArchiveChallengeRows, type CohortArchive } from "./archive";
import cohort22 from "../data/cohort-22-archive.json";

function makeArchive(overrides: Partial<CohortArchive> = {}): CohortArchive {
  return {
    cohort: "22",
    endedOn: "2026-06-23",
    generatedAt: "2026-06-23T00:00:00.000Z",
    totals: {
      students: 4,
      challenges: 2,
      completions: 5,
      avgWeightedScore: 1.5,
      totalWeightedScore: 2.25,
    },
    participants: [],
    challenges: [
      { title: "A", level: "basic", completedCount: 3 },
      { title: "B", level: "advanced", completedCount: 1 },
    ],
    ...overrides,
  };
}

describe("toArchiveChallengeRows", () => {
  it("completedCount/참여자수로 완료율을 계산하고 스냅샷 순서를 유지한다", () => {
    const rows = toArchiveChallengeRows(makeArchive());
    expect(rows.map((r) => r.title)).toEqual(["A", "B"]);
    expect(rows[0]).toMatchObject({ totalStudents: 4, completedCount: 3, percent: 75 });
    expect(rows[1]).toMatchObject({ totalStudents: 4, completedCount: 1, percent: 25 });
  });

  it("참여자가 0명이면 0으로 나누지 않고 0%를 반환한다", () => {
    const rows = toArchiveChallengeRows(
      makeArchive({ totals: { ...makeArchive().totals, students: 0 } }),
    );
    expect(rows.every((r) => r.percent === 0)).toBe(true);
  });
});

describe("cohort-22 스냅샷 무결성", () => {
  const snapshot = cohort22 as CohortArchive;

  it("정적 스냅샷은 22기이고 익명 라벨만 노출한다(닉네임 없음)", () => {
    expect(snapshot.cohort).toBe("22");
    for (const p of snapshot.participants) {
      expect(p.anonymousLabel).toMatch(/^챌린저 /);
      expect(Object.keys(p)).toEqual(["anonymousLabel", "weightedScore", "progressPercent"]);
    }
  });

  it("참여자는 가중 점수 내림차순으로 정렬되어 있다", () => {
    const scores = snapshot.participants.map((p) => p.weightedScore);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it("챌린지는 완료수 내림차순으로 정렬되어 있다", () => {
    const counts = snapshot.challenges.map((c) => c.completedCount);
    const sorted = [...counts].sort((a, b) => b - a);
    expect(counts).toEqual(sorted);
  });

  it("totals가 배열 길이와 일치한다", () => {
    expect(snapshot.totals.students).toBe(snapshot.participants.length);
    expect(snapshot.totals.challenges).toBe(snapshot.challenges.length);
  });
});
