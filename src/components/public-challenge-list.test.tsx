// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";

import PublicChallengeList, { type PublicChallenge } from "./public-challenge-list";

afterEach(cleanup);

const withExample: PublicChallenge = {
  id: "c1",
  title: "오픈클로 or 헤르메스 설치",
  level: "basic",
  description: "설치 과제",
  detail: "OpenClaw 또는 Hermes를 설치합니다.",
  completedCount: 16,
  examples: [
    {
      id: "e1",
      challengeId: "c1",
      title: "오픈클로 설치 텔레그램 연결 범블비",
      summary: "첫 봇 범블비 제작",
      sourceUrl: "https://www.gpters.org/nocode/post/abc",
      sourceAuthor: "CAMI",
    },
  ],
};

const noExample: PublicChallenge = {
  id: "c2",
  title: "텔레그램 스레드 모드 사용해보기",
  level: "basic",
  description: null,
  detail: null,
  completedCount: 3,
  examples: [],
};

describe("PublicChallengeList", () => {
  it("사례가 있으면 배지에 개수를 보여준다", () => {
    render(<PublicChallengeList challenges={[withExample]} totalStudents={46} />);
    expect(screen.getByText("사례 1")).toBeTruthy();
  });

  it("과제를 클릭하면 상세 모달에 선배 사례 링크(새 탭·보안 속성)를 렌더한다", () => {
    render(<PublicChallengeList challenges={[withExample]} totalStudents={46} />);
    fireEvent.click(screen.getByLabelText("오픈클로 or 헤르메스 설치 상세 보기"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("22기 선배 사례")).toBeTruthy();
    const link = within(dialog).getByRole("link", { name: /범블비/ }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://www.gpters.org/nocode/post/abc");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(within(dialog).getByText("by CAMI")).toBeTruthy();
  });

  it("사례가 없으면 배지도 없고 모달에도 선배 사례 섹션이 없다", () => {
    render(<PublicChallengeList challenges={[noExample]} totalStudents={46} />);
    expect(screen.queryByText(/^사례 /)).toBeNull();
    fireEvent.click(screen.getByLabelText("텔레그램 스레드 모드 사용해보기 상세 보기"));
    expect(screen.queryByText("22기 선배 사례")).toBeNull();
  });
});
