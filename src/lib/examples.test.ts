import { describe, expect, it } from "vitest";

import { groupExamplesByChallenge, type ChallengeExample } from "./examples";

function ex(id: string, challengeId: string): ChallengeExample {
  return { id, challengeId, title: `사례 ${id}`, summary: null, sourceUrl: null, sourceAuthor: null };
}

describe("groupExamplesByChallenge", () => {
  it("challengeId로 묶고 그룹 내 입력 순서를 유지한다", () => {
    const map = groupExamplesByChallenge([ex("a", "c1"), ex("b", "c2"), ex("c", "c1")]);
    expect(map.get("c1")?.map((e) => e.id)).toEqual(["a", "c"]);
    expect(map.get("c2")?.map((e) => e.id)).toEqual(["b"]);
    expect(map.has("c3")).toBe(false);
  });

  it("빈 입력은 빈 Map", () => {
    expect(groupExamplesByChallenge([]).size).toBe(0);
  });
});
