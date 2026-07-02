/**
 * stats.ts — DB 결과를 도메인 객체로 모으는 헬퍼.
 *
 * 데이터 흐름:
 *   1. Supabase에서 app_users / challenges / completions 조회
 *   2. challengeCount + per-user completionCount/weightedScore 계산
 *   3. progress.ts의 정렬·라벨 헬퍼로 공개·관리자 뷰 생성
 *
 * 이 모듈은 supabase 클라이언트를 직접 만들지 않는다. 호출자가 주입한다(테스트 용이).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calculateProgressPercent,
  calculateTotalWeightedScore,
  calculateWeightedScore,
  makeAnonymousLabel,
  sortParticipantsForAdmin,
  sortParticipantsForPublic,
  type AdminParticipant,
  type PublicParticipant,
} from "./progress";
import { loadChallengesOrdered } from "./load-challenges";

export interface StudentRow {
  id: string;
  nickname: string;
  anonymousLabel: string;
  anonymousIndex: number | null;
  completedCount: number;
  totalChallenges: number;
  progressPercent: number;
  weightedScore: number;
  totalWeightedScore: number;
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
  challenge_id: string;
}

/**
 * 모든 수강생의 진행률을 한 번에 집계한다.
 * Supabase 호출 3회(users, challenges, completions). 결과는 클라이언트가 즉시 정렬 가능.
 */
export async function loadAllStudentProgress(
  client: SupabaseClient,
): Promise<StudentRow[]> {
  const [
    { data: users, error: usersError },
    challengeResult,
    { data: completions, error: completionError },
  ] = await Promise.all([
    client
      .from("app_users")
      .select("id, nickname, role, anonymous_label, anonymous_index")
      .eq("role", "student"),
    loadChallengesOrdered(client),
    client.from("completions").select("user_id, challenge_id"),
  ]);

  if (usersError) throw usersError;
  if (challengeResult.error) throw challengeResult.error;
  if (completionError) throw completionError;

  const challenges = challengeResult.data;
  const total = challenges.length;
  const totalWeightedScore = calculateTotalWeightedScore(challenges);
  const challengeById = new Map(challenges.map((challenge) => [challenge.id, challenge]));
  const completedByUser = new Map<string, CompletionRow[]>();
  for (const row of (completions ?? []) as CompletionRow[]) {
    const bucket = completedByUser.get(row.user_id) ?? [];
    bucket.push(row);
    completedByUser.set(row.user_id, bucket);
  }

  return ((users ?? []) as AppUserRow[]).map((u) => {
    const completedRows = completedByUser.get(u.id) ?? [];
    const weightedScore = calculateWeightedScore(
      completedRows.map((row) => {
        const challenge = challengeById.get(row.challenge_id);
        return {
          level: challenge?.level ?? "basic",
          tier: challenge?.tier ?? null,
          completed: true,
        };
      }),
    );
    return {
      id: u.id,
      nickname: u.nickname,
      anonymousLabel:
        u.anonymous_label ??
        (u.anonymous_index ? makeAnonymousLabel(u.anonymous_index) : "챌린저 --"),
      anonymousIndex: u.anonymous_index,
      completedCount: completedRows.length,
      totalChallenges: total,
      progressPercent: calculateProgressPercent(weightedScore, totalWeightedScore),
      weightedScore,
      totalWeightedScore,
    };
  });
}

/** 공개 뷰(닉네임 숨김, 가중 점수 높은 순). */
export function toPublicView(rows: readonly StudentRow[]): (PublicParticipant & {
  id: string;
})[] {
  const mapped = rows.map((r) => ({
    id: r.id,
    anonymousLabel: r.anonymousLabel,
    progressPercent: r.progressPercent,
    weightedScore: r.weightedScore,
  }));
  return sortParticipantsForPublic(mapped);
}

/** 관리자 뷰(닉네임 노출, 가중 점수 낮은 순). */
export function toAdminView(rows: readonly StudentRow[]): (AdminParticipant & {
  id: string;
  anonymousLabel: string;
  completedCount: number;
  totalChallenges: number;
  totalWeightedScore: number;
})[] {
  const mapped = rows.map((r) => ({
    id: r.id,
    nickname: r.nickname,
    anonymousLabel: r.anonymousLabel,
    completedCount: r.completedCount,
    totalChallenges: r.totalChallenges,
    progressPercent: r.progressPercent,
    weightedScore: r.weightedScore,
    totalWeightedScore: r.totalWeightedScore,
  }));
  return sortParticipantsForAdmin(mapped);
}
