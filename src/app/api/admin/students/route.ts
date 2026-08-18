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
import {
  getDataRepository,
  isMutationsPausedError,
  requireMutationsEnabled,
} from "@/lib/data";
import { hashPassword } from "@/lib/auth";

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

  const passwordHash = await hashPassword(parsed.password);
  try {
    requireMutationsEnabled();
    const data = await getDataRepository().createStudent({ nickname, passwordHash });
    return NextResponse.json({
      ok: true,
      student: {
        id: data.id,
        nickname: data.nickname,
        anonymousLabel: data.anonymous_label,
        anonymousIndex: data.anonymous_index,
      },
    });
  } catch (error) {
    if (isMutationsPausedError(error)) {
      return NextResponse.json({ ok: false, error: "데이터 전환 점검 중입니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
    const code = (error as { code?: string }).code;
    if (code === "nickname_conflict" || (error as { status?: number }).status === 409) {
      return NextResponse.json({ ok: false, error: "이미 사용 중인 닉네임입니다." }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "등록 실패";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
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

  const passwordHash = await hashPassword(parsed.password);
  try {
    requireMutationsEnabled();
    const data = await getDataRepository().updateStudentPassword({ id: parsed.id, passwordHash });
    if (!data) {
      return NextResponse.json({ ok: false, error: "수강생을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, student: data });
  } catch (error) {
    if (isMutationsPausedError(error)) {
      return NextResponse.json({ ok: false, error: "데이터 전환 점검 중입니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "수정 실패";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
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

  try {
    requireMutationsEnabled();
    const data = await getDataRepository().deleteStudent(parsed.id);
    if (!data) {
      return NextResponse.json({ ok: false, error: "수강생을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, student: data });
  } catch (error) {
    if (isMutationsPausedError(error)) {
      return NextResponse.json({ ok: false, error: "데이터 전환 점검 중입니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "삭제 실패";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
