import { describe, expect, it } from "vitest";

// @ts-expect-error — .mjs 스크립트 헬퍼(타입 선언 없음). Vite가 ESM으로 로드.
import { parseCaseNote, splitFrontmatter, section, listField } from "./case-note.mjs";

const SAMPLE = `---
type: article
aliases:
  - 오픈클로 설치에서 텔레그램 연결
author: "[[베르단디]]"
tags:
  - 22기-반려에이전트
  - openclaw
source_url: https://www.gpters.org/nocode/post/abc
source_author: CAMI
study: 22기 반려 에이전트
status: completed
---

# 오픈클로 설치 텔레그램 연결 범블비

## 출처
- 작성자: CAMI

## 핵심 요약
OpenClaw 설치·텔레그램 연결로 첫 AI 에이전트 제작.

## 사용한 도구
- OpenClaw
- Telegram
`;

describe("parseCaseNote", () => {
  it("frontmatter와 본문 섹션을 구조화한다", () => {
    const note = parseCaseNote(SAMPLE, "오픈클로 설치 텔레그램 연결 범블비.md");
    expect(note).not.toBeNull();
    expect(note.title).toBe("오픈클로 설치 텔레그램 연결 범블비");
    expect(note.summary).toBe("OpenClaw 설치·텔레그램 연결로 첫 AI 에이전트 제작.");
    expect(note.tools).toEqual(["OpenClaw", "Telegram"]);
    expect(note.tags).toEqual(["22기-반려에이전트", "openclaw"]);
    expect(note.sourceUrl).toBe("https://www.gpters.org/nocode/post/abc");
    expect(note.sourceAuthor).toBe("CAMI");
  });

  it("type:article이 아니거나 source_url이 없으면 null (인덱스 노트 제외)", () => {
    const indexNote = `---\ntype: index\n---\n# _index\n`;
    expect(parseCaseNote(indexNote, "_index.md")).toBeNull();
    const noUrl = `---\ntype: article\n---\n# 제목\n`;
    expect(parseCaseNote(noUrl, "x.md")).toBeNull();
  });
});

describe("frontmatter helpers", () => {
  it("splitFrontmatter는 블록과 본문을 나눈다", () => {
    const { frontmatter, body } = splitFrontmatter(SAMPLE);
    expect(frontmatter).toContain("type: article");
    expect(body).toContain("# 오픈클로");
  });

  it("listField는 들여쓴 목록을 읽고 다음 키에서 멈춘다", () => {
    const { frontmatter } = splitFrontmatter(SAMPLE);
    expect(listField(frontmatter, "tags")).toEqual(["22기-반려에이전트", "openclaw"]);
  });

  it("section은 다음 ## 헤더 전까지 읽는다", () => {
    const { body } = splitFrontmatter(SAMPLE);
    expect(section(body, "핵심 요약")).toBe("OpenClaw 설치·텔레그램 연결로 첫 AI 에이전트 제작.");
  });
});
