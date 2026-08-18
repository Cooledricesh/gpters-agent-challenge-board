/**
 * 관리자 — 챌린지 CRUD.
 *
 * POST: 새 챌린지 등록. order_index는 현재 최대값 + 1로 자동 부여.
 * PATCH: 기존 챌린지의 제목/짧은 설명/상세 내용/기본·고급 구분 변경.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import {
  getDataRepository,
  isMutationsPausedError,
  requireMutationsEnabled,
} from "@/lib/data";
import {
  normalizeChallengeArea,
  normalizeChallengeLevel,
  normalizeChallengeUpdateInput,
  type ChallengeAreaKey,
} from "@/lib/challenges";

const ChallengeAreaSchema = z.enum([
  "start",
  "channel",
  "automation",
  "content",
  "operations",
  "integrations",
  "orchestration",
  "build",
  "voice-ui",
  "edge",
  "other",
] satisfies [ChallengeAreaKey, ...ChallengeAreaKey[]]);

const CreateBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  detail: z.string().max(5000).nullable().optional(),
  level: z.enum(["basic", "advanced"]).optional(),
  area: ChallengeAreaSchema.nullable().optional(),
});

const UpdateChallengeBody = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  detail: z.string().max(5000).nullable().optional(),
  level: z.enum(["basic", "advanced"]).optional(),
  area: ChallengeAreaSchema.nullable().optional(),
});

function schemaUpdateRequiredResponse(message: string) {
  const isMissingLevel = message.includes("level") || message.includes("schema cache");
  const isMissingDetail = message.includes("detail");
  const isMissingArea = message.includes("area");
  return NextResponse.json(
    {
      ok: false,
      error: isMissingLevel || isMissingDetail || isMissingArea
        ? "선택한 데이터 backend에 최신 schema를 먼저 적용해주세요."
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

  const level = normalizeChallengeLevel(parsed.level);
  const area = normalizeChallengeArea(parsed.area);
  try {
    requireMutationsEnabled();
    const data = await getDataRepository().createChallenge({
      title: parsed.title,
      description: parsed.description ?? null,
      detail: parsed.detail ?? null,
      level,
      area,
    });
    return NextResponse.json({ ok: true, challenge: data });
  } catch (error) {
    if (isMutationsPausedError(error)) {
      return NextResponse.json({ ok: false, error: "데이터 전환 점검 중입니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "등록 실패";
    return schemaUpdateRequiredResponse(message);
  }
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

  const update =
    parsed.title !== undefined
      ? normalizeChallengeUpdateInput({
          title: parsed.title,
          description: parsed.description,
          detail: parsed.detail,
          level: parsed.level,
          area: parsed.area,
        })
      : {
          ...(parsed.level !== undefined ? { level: normalizeChallengeLevel(parsed.level) } : {}),
          ...(parsed.area !== undefined ? { area: normalizeChallengeArea(parsed.area) } : {}),
        };

  try {
    requireMutationsEnabled();
    const data = await getDataRepository().updateChallenge({ id: parsed.id, ...update });
    if (!data) {
      return NextResponse.json({ ok: false, error: "챌린지를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, challenge: data });
  } catch (error) {
    if (isMutationsPausedError(error)) {
      return NextResponse.json({ ok: false, error: "데이터 전환 점검 중입니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "수정 실패";
    return schemaUpdateRequiredResponse(message);
  }
}
