/**
 * 관리자 — 수강생 계정 관리.
 *
 * 정책:
 *   - 관리자가 닉네임 + 임의 비밀번호를 직접 지정한다.
 *   - 비밀번호는 bcrypt 해시로만 저장한다.
 *   - anonymous_index = 현재 최대 + 1, anonymous_label = "챌린저 NN".
 *   - PATCH로 비밀번호 변경, DELETE로 수강생 삭제를 지원한다.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { hashPassword } from "@/lib/auth";
import { makeAnonymousLabel, nextAnonymousIndex } from "@/lib/progress";

const CreateBody = z.object({
  nickname: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

const UpdatePasswordBody = z.object({
  id: z.string().uuid(),
  password: z.string().min(1).max(128),
});

const DeleteBody = z.object({
  id: z.string().uuid(),
});

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
    return NextResponse.json({ ok: false, error: "아이디와 비밀번호를 확인해주세요." }, { status: 400 });
  }
  const nickname = parsed.nickname.trim();
  if (nickname.toLowerCase() === "admin") {
    return NextResponse.json({ ok: false, error: "닉네임 'admin'은 예약어입니다." }, { status: 400 });
  }

  const client = getSupabaseServiceClient();

  const { data: dup } = await client
    .from("app_users")
    .select("id")
    .eq("nickname", nickname)
    .maybeSingle();
  if (dup) {
    return NextResponse.json({ ok: false, error: "이미 사용 중인 닉네임입니다." }, { status: 409 });
  }

  const { data: indexRows, error: idxErr } = await client
    .from("app_users")
    .select("anonymous_index")
    .eq("role", "student");
  if (idxErr) {
    return NextResponse.json({ ok: false, error: idxErr.message }, { status: 500 });
  }
  const nextIdx = nextAnonymousIndex(
    ((indexRows ?? []) as { anonymous_index: number | null }[]).map((r) => r.anonymous_index),
  );
  const anonymousLabel = makeAnonymousLabel(nextIdx);
  const passwordHash = await hashPassword(parsed.password);

  const { data, error } = await client
    .from("app_users")
    .insert({
      nickname,
      role: "student",
      password_hash: passwordHash,
      anonymous_index: nextIdx,
      anonymous_label: anonymousLabel,
    })
    .select("id, nickname, anonymous_label, anonymous_index")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "등록 실패" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    student: {
      id: data.id,
      nickname: data.nickname,
      anonymousLabel: data.anonymous_label,
      anonymousIndex: data.anonymous_index,
    },
  });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminJson();
  if (unauthorized) return unauthorized;

  let parsed: z.infer<typeof UpdatePasswordBody>;
  try {
    parsed = UpdatePasswordBody.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "수강생과 새 비밀번호를 확인해주세요." }, { status: 400 });
  }

  const client = getSupabaseServiceClient();
  const passwordHash = await hashPassword(parsed.password);
  const { data, error } = await client
    .from("app_users")
    .update({ password_hash: passwordHash })
    .eq("id", parsed.id)
    .eq("role", "student")
    .select("id, nickname")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "수강생을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, student: data });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdminJson();
  if (unauthorized) return unauthorized;

  let parsed: z.infer<typeof DeleteBody>;
  try {
    parsed = DeleteBody.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "삭제할 수강생을 확인해주세요." }, { status: 400 });
  }

  const client = getSupabaseServiceClient();
  const { data, error } = await client
    .from("app_users")
    .delete()
    .eq("id", parsed.id)
    .eq("role", "student")
    .select("id, nickname")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "수강생을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, student: data });
}
