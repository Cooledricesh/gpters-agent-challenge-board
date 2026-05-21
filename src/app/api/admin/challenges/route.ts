/**
 * 관리자 — 챌린지 CRUD.
 *
 * POST: 새 챌린지 등록. order_index는 현재 최대값 + 1로 자동 부여.
 * PATCH: 기존 챌린지의 제목/짧은 설명/상세 내용/기본·고급 구분 변경.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { normalizeChallengeLevel, normalizeChallengeUpdateInput } from "@/lib/challenges";

const CreateBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  detail: z.string().max(5000).nullable().optional(),
  level: z.enum(["basic", "advanced"]).optional(),
});

const UpdateChallengeBody = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  detail: z.string().max(5000).nullable().optional(),
  level: z.enum(["basic", "advanced"]).optional(),
});

function schemaUpdateRequiredResponse(message: string) {
  const isMissingLevel = message.includes("level") || message.includes("schema cache");
  const isMissingDetail = message.includes("detail");
  return NextResponse.json(
    {
      ok: false,
      error: isMissingLevel || isMissingDetail
        ? "Supabase SQL Editor에서 최신 supabase/schema.sql을 먼저 실행해주세요."
        : message,
    },
    { status: 500 },
  );
}

async function requireAdminJson() {
  const session = await requireSession("admin");
  if (!session) {
    return NextResponse.json({ ok: false, error: "관리자 권한이 필요합니다." }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminJson();
  if (unauthorized) return unauthorized;

  let parsed: z.infer<typeof CreateBody>;
  try {
    parsed = CreateBody.parse(await request.json());
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
      detail: parsed.detail ?? null,
      order_index: nextOrder,
      level,
    })
    .select("id, title, order_index, level, detail")
    .single();
  if (error || !data) {
    return schemaUpdateRequiredResponse(error?.message ?? "등록 실패");
  }
  return NextResponse.json({ ok: true, challenge: data });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminJson();
  if (unauthorized) return unauthorized;

  let parsed: z.infer<typeof UpdateChallengeBody>;
  try {
    parsed = UpdateChallengeBody.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "챌린지 수정값을 확인해주세요." }, { status: 400 });
  }

  const client = getSupabaseServiceClient();
  const update =
    parsed.title !== undefined
      ? normalizeChallengeUpdateInput({
          title: parsed.title,
          description: parsed.description,
          detail: parsed.detail,
          level: parsed.level,
        })
      : { level: normalizeChallengeLevel(parsed.level) };

  const { data, error } = await client
    .from("challenges")
    .update(update)
    .eq("id", parsed.id)
    .select("id, title, description, detail, level")
    .maybeSingle();

  if (error) return schemaUpdateRequiredResponse(error.message);
  if (!data) {
    return NextResponse.json({ ok: false, error: "챌린지를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, challenge: data });
}
