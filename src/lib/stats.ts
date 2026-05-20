/**
 * stats.ts — DB 결과를 도메인 객체로 모으는 헬퍼.
 *
 * 데이터 흐름:
 *   1. Supabase에서 app_users / challenges / completions 조회
 *   2. challengeCount + per-user completionCount 계산
 *   3. progress.ts의 정렬·라벨 헬퍼로 공개·관리자 뷰 생성
 *
 * 이 모듈은 supabase 클라이언트를 직접 만들지 않는다. 호출자가 주입한다(테스트 용이).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calculateProgressPercent,
  makeAnonymousLabel,
  sortParticipantsForAdmin,
  sortParticipantsForPublic,
  type AdminParticipant,
  type PublicParticipant,
} from "./progress";

export interface StudentRow {
  id: string;
  nickname: string;
  anonymousLabel: string;
  anonymousIndex: number | null;
  completedCount: number;
  totalChallenges: number;
  progressPercent: number;
}

interface AppUserRow {
  id: string;
  nickname: string;
  role: string;
  anonymous_label: string | null;
  anonymous_index: number | null;
}

interface CompletionRow {
  user_id: string;
}

/**
 * 모든 수강생의 진행률을 한 번에 집계한다.
 * Supabase 호출 3회(users, challenges count, completions). 결과는 클라이언트가 즉시 정렬 가능.
 */
export async function loadAllStudentProgress(
  client: SupabaseClient,
): Promise<StudentRow[]> {
  const [
    { data: users, error: usersError },
    { count: challengeCount, error: challengeError },
    { data: completions, error: completionError },
  ] = await Promise.all([
    client
      .from("app_users")
      .select("id, nickname, role, anonymous_label, anonymous_index")
      .eq("role", "student"),
    client.from("challenges").select("*", { count: "exact", head: true }),
    client.from("completions").select("user_id"),
  ]);

  if (usersError) throw usersError;
  if (challengeError) throw challengeError;
  if (completionError) throw completionError;

  const total = challengeCount ?? 0;
  const completedByUser = new Map<string, number>();
  for (const row of (completions ?? []) as CompletionRow[]) {
    completedByUser.set(row.user_id, (completedByUser.get(row.user_id) ?? 0) + 1);
  }

  return ((users ?? []) as AppUserRow[]).map((u) => {
    const completed = completedByUser.get(u.id) ?? 0;
    return {
      id: u.id,
      nickname: u.nickname,
      anonymousLabel:
        u.anonymous_label ??
        (u.anonymous_index ? makeAnonymousLabel(u.anonymous_index) : "챌린저 --"),
      anonymousIndex: u.anonymous_index,
      completedCount: completed,
      totalChallenges: total,
      progressPercent: calculateProgressPercent(completed, total),
    };
  });
}

/** 공개 뷰(닉네임 숨김, 진척도 높은 순). */
export function toPublicView(rows: readonly StudentRow[]): PublicParticipant[] {
  const mapped = rows.map((r) => ({
    anonymousLabel: r.anonymousLabel,
    progressPercent: r.progressPercent,
  }));
  return sortParticipantsForPublic(mapped);
}

/** 관리자 뷰(닉네임 노출, 진척도 낮은 순). */
export function toAdminView(rows: readonly StudentRow[]): (AdminParticipant & {
  id: string;
  anonymousLabel: string;
  completedCount: number;
  totalChallenges: number;
})[] {
  const mapped = rows.map((r) => ({
    id: r.id,
    nickname: r.nickname,
    anonymousLabel: r.anonymousLabel,
    completedCount: r.completedCount,
    totalChallenges: r.totalChallenges,
    progressPercent: r.progressPercent,
  }));
  return sortParticipantsForAdmin(mapped);
}
