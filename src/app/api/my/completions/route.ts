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

import { requireSession } from "@/lib/session";
import { getSupabaseServiceClient } from "@/lib/supabase";

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
  const { challengeId, done } = parsed;
  const client = getSupabaseServiceClient();

  if (done) {
    // upsert via unique(user_id, challenge_id) — 중복 시 ignore.
    const { error } = await client
      .from("completions")
      .upsert(
        { user_id: session.sub, challenge_id: challengeId },
        { onConflict: "user_id,challenge_id", ignoreDuplicates: true },
      );
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await client
      .from("completions")
      .delete()
      .eq("user_id", session.sub)
      .eq("challenge_id", challengeId);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, done });
}
