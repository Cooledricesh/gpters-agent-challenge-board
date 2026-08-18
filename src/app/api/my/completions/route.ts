/**
 * 수강생용 토글 API — 본인 완료 체크/해제.
 *
 * 입력: { challengeId, done }.
 * 가드:
 *   - student 세션 필수.
 *   - user_id는 무조건 session.sub로 강제. body의 user_id는 절대 신뢰하지 않는다.
 * done=true → upsert (idempotent). false → delete.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getDataRepository,
  isMutationsPausedError,
  requireMutationsEnabled,
} from "@/lib/data";
import { requireSession } from "@/lib/session";

const Body = z.object({
  challengeId: z.string().uuid(),
  done: z.boolean(),
});

export async function POST(request: Request) {
  const session = await requireSession("student");
  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 입력입니다." }, { status: 400 });
  }

  try {
    requireMutationsEnabled();
    await getDataRepository().toggleCompletion({
      userId: session.sub,
      challengeId: parsed.challengeId,
      done: parsed.done,
    });
  } catch (error) {
    if (isMutationsPausedError(error)) {
      return NextResponse.json(
        { ok: false, error: "데이터 이전 점검 중입니다. 잠시 후 다시 시도해주세요." },
        { status: 503 },
      );
    }
    const message = error instanceof Error ? error.message : "completion_update_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, done: parsed.done });
}
