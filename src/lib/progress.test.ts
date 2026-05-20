import { describe, expect, it } from "vitest";

import {
  calculateProgressPercent,
  getMotivationalMessage,
  makeAnonymousLabel,
  nextAnonymousIndex,
  sortParticipantsForAdmin,
  sortParticipantsForPublic,
} from "./progress";

describe("progress helpers", () => {
  it("creates challenger labels padded to two digits", () => {
    expect(makeAnonymousLabel(1)).toBe("챌린저 01");
    expect(makeAnonymousLabel(31)).toBe("챌린저 31");
  });

  it("calculates rounded progress safely", () => {
    expect(calculateProgressPercent(0, 0)).toBe(0);
    expect(calculateProgressPercent(1, 3)).toBe(33);
    expect(calculateProgressPercent(3, 3)).toBe(100);
  });

  it("sorts public participants by highest progress first", () => {
    const sorted = sortParticipantsForPublic([
      { anonymousLabel: "챌린저 02", progressPercent: 30 },
      { anonymousLabel: "챌린저 01", progressPercent: 80 },
      { anonymousLabel: "챌린저 03", progressPercent: 80 },
    ]);

    expect(sorted.map((item) => item.anonymousLabel)).toEqual([
      "챌린저 01",
      "챌린저 03",
      "챌린저 02",
    ]);
  });

  it("sorts admin participants by lowest progress first", () => {
    const sorted = sortParticipantsForAdmin([
      { nickname: "A", progressPercent: 80 },
      { nickname: "B", progressPercent: 20 },
      { nickname: "C", progressPercent: 20 },
    ]);

    expect(sorted.map((item) => item.nickname)).toEqual(["B", "C", "A"]);
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
