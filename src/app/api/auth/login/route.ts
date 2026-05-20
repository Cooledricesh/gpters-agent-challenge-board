/**
 * 로그인 API.
 *
 * 입력: { nickname, password }.
 * 분기:
 *   - nickname === "admin" → ADMIN_PASSWORD env 비교. 일치 시 admin 세션 발급.
 *     관리자 row가 DB에 없으면 즉석 upsert(시드 누락 대비).
 *   - 그 외 → app_users 조회 → bcrypt verify.
 *
 * 응답: { ok, redirect }.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { serverEnv } from "@/lib/env";
import { getSupabaseServiceClient } from "@/lib/supabase";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  hashPassword,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";

const Body = z.object({
  nickname: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 입력입니다." }, { status: 400 });
  }
  const { nickname, password } = parsed;

  try {
    const client = getSupabaseServiceClient();

    if (nickname.toLowerCase() === "admin") {
      if (password !== serverEnv.adminPassword) {
        return NextResponse.json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
      }
      // 관리자 row 보장(없으면 생성).
      const { data: existing } = await client
        .from("app_users")
        .select("id, nickname, role")
        .eq("nickname", "admin")
        .maybeSingle();
      let adminId = existing?.id as string | undefined;
      if (!adminId) {
        const passwordHash = await hashPassword(password);
        const { data: inserted, error: insErr } = await client
          .from("app_users")
          .insert({ nickname: "admin", role: "admin", password_hash: passwordHash })
          .select("id")
          .single();
        if (insErr || !inserted) {
          return NextResponse.json(
            { ok: false, error: `관리자 계정 생성 실패: ${insErr?.message ?? "unknown"}` },
            { status: 500 },
          );
        }
        adminId = inserted.id as string;
      }
      const token = await createSessionToken({ sub: adminId, nickname: "admin", role: "admin" });
      const store = await cookies();
      store.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
      return NextResponse.json({ ok: true, redirect: "/admin" });
    }

    const { data: user, error } = await client
      .from("app_users")
      .select("id, nickname, role, password_hash")
      .eq("nickname", nickname)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ ok: false, error: `DB 오류: ${error.message}` }, { status: 500 });
    }
    if (!user || !user.password_hash || user.role !== "student") {
      return NextResponse.json(
        { ok: false, error: "닉네임 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "닉네임 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }
    const token = await createSessionToken({ sub: user.id, nickname: user.nickname, role: "student" });
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return NextResponse.json({ ok: true, redirect: "/" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
