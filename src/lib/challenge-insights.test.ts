import { describe, expect, it } from "vitest";

import {
  challengeCompletionInsight,
  countCompletionsByChallenge,
  sortChallengesByCompletionCount,
} from "./challenge-insights";

describe("challenge insights", () => {
  it("counts completions per challenge", () => {
    const counts = countCompletionsByChallenge([
      { challenge_id: "c1" },
      { challenge_id: "c1" },
      { challenge_id: "c2" },
    ]);

    expect(counts.get("c1")).toBe(2);
    expect(counts.get("c2")).toBe(1);
    expect(counts.get("c3") ?? 0).toBe(0);
  });

  it("highlights when the current learner is the only completer", () => {
    expect(challengeCompletionInsight({ completedCount: 1, totalStudents: 31, done: true })).toBe(
      "나만 완료했어요! 선두 주자예요 ✨",
    );
  });

  it("shows nobody has completed a challenge yet", () => {
    expect(challengeCompletionInsight({ completedCount: 0, totalStudents: 31, done: false })).toBe(
      "아직 아무도 완료하지 않았어요",
    );
  });

  it("shows completion counts without percentage noise", () => {
    expect(challengeCompletionInsight({ completedCount: 3, totalStudents: 31, done: false })).toBe(
      "3명이 완료했어요",
    );
  });

  it("sorts public challenge stats by completion count descending", () => {
    expect(
      sortChallengesByCompletionCount([
        { title: "아무도 안 한 과제", completedCount: 0 },
        { title: "많이 한 과제", completedCount: 12 },
        { title: "조금 한 과제", completedCount: 3 },
      ]).map((challenge) => challenge.title),
    ).toEqual(["많이 한 과제", "조금 한 과제", "아무도 안 한 과제"]);
  });
});
