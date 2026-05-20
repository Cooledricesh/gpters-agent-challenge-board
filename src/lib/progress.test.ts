import { describe, expect, it } from "vitest";

import {
  BASIC_CHALLENGE_WEIGHT,
  ADVANCED_CHALLENGE_WEIGHT,
  calculateProgressPercent,
  calculateWeightedScore,
  formatWeightedScore,
  getMotivationalMessage,
  makeAnonymousLabel,
  nextAnonymousIndex,
  rankParticipant,
  sortParticipantsForAdmin,
  sortParticipantsForPublic,
} from "./progress";

describe("progress helpers", () => {
  it("creates challenger labels padded to two digits", () => {
    expect(makeAnonymousLabel(1)).toBe("챌린저 01");
    expect(makeAnonymousLabel(31)).toBe("챌린저 31");
  });

  it("uses basic=1 and advanced=1.25 for weighted scores", () => {
    expect(BASIC_CHALLENGE_WEIGHT).toBe(1);
    expect(ADVANCED_CHALLENGE_WEIGHT).toBe(1.25);
    expect(
      calculateWeightedScore([
        { level: "basic", completed: true },
        { level: "advanced", completed: true },
        { level: "advanced", completed: false },
      ]),
    ).toBe(2.25);
  });

  it("formats weighted scores without noisy trailing zeros", () => {
    expect(formatWeightedScore(3)).toBe("3점");
    expect(formatWeightedScore(3.25)).toBe("3.25점");
    expect(formatWeightedScore(3.5)).toBe("3.5점");
  });

  it("calculates rounded progress safely", () => {
    expect(calculateProgressPercent(0, 0)).toBe(0);
    expect(calculateProgressPercent(1, 3)).toBe(33);
    expect(calculateProgressPercent(3, 3)).toBe(100);
  });

  it("sorts public participants by highest weighted score first", () => {
    const sorted = sortParticipantsForPublic([
      { anonymousLabel: "챌린저 02", progressPercent: 30, weightedScore: 3 },
      { anonymousLabel: "챌린저 01", progressPercent: 80, weightedScore: 5.25 },
      { anonymousLabel: "챌린저 03", progressPercent: 80, weightedScore: 5.25 },
    ]);

    expect(sorted.map((item) => item.anonymousLabel)).toEqual([
      "챌린저 01",
      "챌린저 03",
      "챌린저 02",
    ]);
  });

  it("sorts admin participants by lowest weighted score first", () => {
    const sorted = sortParticipantsForAdmin([
      { nickname: "A", progressPercent: 80, weightedScore: 8 },
      { nickname: "B", progressPercent: 20, weightedScore: 2.25 },
      { nickname: "C", progressPercent: 20, weightedScore: 2.25 },
    ]);

    expect(sorted.map((item) => item.nickname)).toEqual(["B", "C", "A"]);
  });

  it("ranks a participant by weighted score with competition ranking", () => {
    const rank = rankParticipant("u3", [
      { id: "u1", progressPercent: 100, weightedScore: 10 },
      { id: "u2", progressPercent: 80, weightedScore: 8.25 },
      { id: "u3", progressPercent: 80, weightedScore: 8.25 },
      { id: "u4", progressPercent: 20, weightedScore: 2 },
    ]);

    expect(rank).toEqual({ rank: 2, total: 4, tiedCount: 2, aheadCount: 1 });
  });

  it("returns null rank for missing participants", () => {
    expect(rankParticipant("missing", [{ id: "u1", progressPercent: 100, weightedScore: 10 }])).toBeNull();
  });

  it("returns a completion message at 100 percent", () => {
    expect(getMotivationalMessage(100)).toContain("완주");
  });

  it("computes the next anonymous_index from existing labels", () => {
    expect(nextAnonymousIndex([])).toBe(1);
    expect(nextAnonymousIndex([1, 2, 3])).toBe(4);
    expect(nextAnonymousIndex([null, 5, undefined, 2])).toBe(6);
    expect(nextAnonymousIndex([NaN, -3, 0])).toBe(1);
  });
});
