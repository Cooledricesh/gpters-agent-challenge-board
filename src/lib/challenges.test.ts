import { describe, expect, it } from "vitest";

import {
  getChallengeArea,
  groupChallengesByArea,
  groupChallengesByLevel,
  normalizeChallengeLevel,
  normalizeChallengeUpdateInput,
} from "./challenges";

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

  it("classifies challenges into intuitive areas by level and title", () => {
    expect(getChallengeArea({ title: "오픈클로 or 헤르메스 설치", level: "basic" })).toBe("start");
    expect(getChallengeArea({ title: "구글 캘린더 연결하기", level: "basic" })).toBe("channel");
    expect(getChallengeArea({ title: "매일 아침 날씨 브리핑 받기", level: "basic" })).toBe("automation");
    expect(getChallengeArea({ title: "유튜브 링크 주고 내용 요약시키기", level: "basic" })).toBe("content");
    expect(getChallengeArea({ title: "검문소", level: "basic" })).toBe("operations");

    expect(getChallengeArea({ title: "옵시디언에 연결하기", level: "advanced" })).toBe("integrations");
    expect(getChallengeArea({ title: "봇투봇 커뮤니케이션", level: "advanced" })).toBe("orchestration");
    expect(getChallengeArea({ title: "LLM-wiki 체계 만들기", level: "advanced" })).toBe("build");
    expect(getChallengeArea({ title: "프레젠테이션 작성 시켜보기", level: "advanced" })).toBe("build");
    expect(getChallengeArea({ title: "TTS 설정해서 목소리 만들어주기", level: "advanced" })).toBe("voice-ui");
    expect(getChallengeArea({ title: "자동 결제", level: "advanced" })).toBe("edge");
  });

  it("groups challenges by area while preserving order inside each area", () => {
    const sections = groupChallengesByArea("basic", [
      { id: "1", title: "유튜브 링크 주고 내용 요약시키기", level: "basic" },
      { id: "2", title: "오픈클로 or 헤르메스 설치", level: "basic" },
      { id: "3", title: "이미지 생성 시켜보기", level: "basic" },
      { id: "4", title: "검문소", level: "basic" },
    ]);

    expect(sections.map((section) => section.key)).toEqual(["start", "content", "operations"]);
    expect(sections.find((section) => section.key === "content")?.items.map((item) => item.id)).toEqual([
      "1",
      "3",
    ]);
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
