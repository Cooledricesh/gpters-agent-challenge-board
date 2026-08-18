/**
 * 로그인 API.
 *
 * 입력: { nickname, password }.
 * 분기:
 *   - nickname === "admin" → ADMIN_PASSWORD env 비교. 일치 시 admin 세션 발급.
 *     관리자 row는 양쪽 DB에 사전 배치하며 로그인 중 DB mutation은 하지 않는다.
 *   - 그 외 → app_users 조회 → bcrypt verify.
 *
 * 응답: { ok, redirect }.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { serverEnv } from "@/lib/env";
import { getDataRepository } from "@/lib/data";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
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
    const repository = getDataRepository();

    if (nickname.toLowerCase() === "admin") {
      if (password !== serverEnv.adminPassword) {
        return NextResponse.json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
      }
      const admin = await repository.findUserByNickname("admin");
      if (!admin || admin.role !== "admin") {
        return NextResponse.json(
          { ok: false, error: "관리자 계정이 준비되지 않았습니다." },
          { status: 503 },
        );
      }
      const token = await createSessionToken({ sub: admin.id, nickname: "admin", role: "admin" });
      const store = await cookies();
      store.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
      return NextResponse.json({ ok: true, redirect: "/admin" });
    }

    const user = await repository.findUserByNickname(nickname);
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
    return NextResponse.json({ ok: true, redirect: "/my" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
