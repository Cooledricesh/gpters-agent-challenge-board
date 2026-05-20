/**
 * 관리자 — 챌린지 CRUD (POST only for MVP).
 *
 * order_index는 현재 최대값 + 1로 자동 부여.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { normalizeChallengeLevel } from "@/lib/challenges";

const Body = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  level: z.enum(["basic", "advanced"]).optional(),
});

export async function POST(request: Request) {
  const session = await requireSession("admin");
  if (!session) {
    return NextResponse.json({ ok: false, error: "관리자 권한이 필요합니다." }, { status: 401 });
  }

  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 입력입니다." }, { status: 400 });
  }

  const client = getSupabaseServiceClient();
  // 최대 order_index + 1
  const { data: maxRow, error: maxErr } = await client
    .from("challenges")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) {
    return NextResponse.json({ ok: false, error: maxErr.message }, { status: 500 });
  }
  const nextOrder = (maxRow?.order_index ?? 0) + 1;

  const level = normalizeChallengeLevel(parsed.level);
  const { data, error } = await client
    .from("challenges")
    .insert({
      title: parsed.title,
      description: parsed.description ?? null,
      order_index: nextOrder,
      level,
    })
    .select("id, title, order_index, level")
    .single();
  if (error || !data) {
    const message = error?.message ?? "등록 실패";
    const isMissingLevel = message.includes("level") || message.includes("schema cache");
    return NextResponse.json(
      {
        ok: false,
        error: isMissingLevel
          ? "Supabase SQL Editor에서 최신 supabase/schema.sql을 먼저 실행해주세요."
          : message,
      },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, challenge: data });
}
