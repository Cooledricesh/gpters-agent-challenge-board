/**
 * 회귀 방지: 글로벌 레이아웃(`src/app/layout.tsx`)은 모든 라우트에 동일하게
 * 적용되므로 수강생 닉네임을 렌더해서는 안 된다. 닉네임이 노출되면
 * 공개 페이지(/)의 익명성 요구사항이 깨진다. layout 본문에서 `session.nickname`
 * 또는 `session.phone` 참조가 발견되면 실패시킨다.
 *
 * 참고: 닉네임은 /my(본인) 및 /admin(관리자 화면 내부)에서만 표시되어야 한다.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("global layout privacy", () => {
  const layoutSource = readFileSync(
    join(__dirname, "layout.tsx"),
    "utf8",
  );

  it("does not render session.nickname in the shared layout", () => {
    expect(layoutSource).not.toMatch(/session\.nickname/);
  });

  it("does not render phone fields in the shared layout", () => {
    expect(layoutSource).not.toMatch(/phone/i);
  });
});
