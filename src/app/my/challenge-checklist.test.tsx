// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import ChallengeChecklist from "./challenge-checklist";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

describe("ChallengeChecklist detail modal", () => {
  it("기술트리 과제를 클릭하면 사례 링크와 완료 체크 버튼을 함께 보여준다", () => {
    render(
      <ChallengeChecklist
        initial={[
          {
            id: "challenge-1",
            title: "헤르메스 설치",
            description: "설치 과제",
            detail: "Hermes를 설치합니다.",
            level: "basic",
            area: "start",
            tier: 1,
            prerequisiteId: null,
            completedCount: 0,
            totalStudents: 1,
            done: false,
            examples: [
              {
                id: "example-1",
                challengeId: "challenge-1",
                title: "선배 설치 사례",
                summary: "설치 경험",
                sourceUrl: "https://www.gpters.org/nocode/post/example",
                sourceAuthor: "선배",
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByLabelText("헤르메스 설치 상세 보기"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: /선배 설치 사례/ })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "완료 체크" })).toBeTruthy();
  });
});
