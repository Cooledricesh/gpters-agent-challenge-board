/**
 * progress.ts — 챌린지 진행률·정렬·라벨 헬퍼.
 *
 * 단위 테스트: src/lib/progress.test.ts
 * 도메인 결정사항(스펙):
 * - 공개 페이지: 닉네임 노출 금지, "챌린저 01" 형식 익명 라벨, 가중 점수 높은 순 정렬.
 * - 관리자 페이지: 닉네임 노출, 가중 점수 낮은 순(독려 대상 우선) 정렬.
 * - 가중치: 기본 과제 1점, 고급 과제 1.25점.
 * - 비밀번호: 관리자가 수강생별로 직접 지정한 값을 bcrypt 해시로 저장한다.
 */

import { normalizeChallengeLevel, type ChallengeLevel } from "./challenges";

export const BASIC_CHALLENGE_WEIGHT = 1;
export const ADVANCED_CHALLENGE_WEIGHT = 1.25;

export interface PublicParticipant {
  anonymousLabel: string;
  progressPercent: number;
  weightedScore: number;
}

export interface AdminParticipant {
  nickname: string;
  progressPercent: number;
  weightedScore: number;
}

export interface RankableParticipant {
  id: string;
  progressPercent: number;
  weightedScore: number;
}

export interface ParticipantRank {
  rank: number;
  total: number;
  tiedCount: number;
  aheadCount: number;
}

export interface WeightedChallengeInput {
  level: ChallengeLevel | string | null | undefined;
  completed: boolean;
}

export function challengeWeight(level: ChallengeLevel | string | null | undefined): number {
  return normalizeChallengeLevel(level) === "advanced"
    ? ADVANCED_CHALLENGE_WEIGHT
    : BASIC_CHALLENGE_WEIGHT;
}

export function calculateWeightedScore(challenges: readonly WeightedChallengeInput[]): number {
  return challenges.reduce((sum, item) => sum + (item.completed ? challengeWeight(item.level) : 0), 0);
}

export function calculateTotalWeightedScore(
  challenges: readonly Pick<WeightedChallengeInput, "level">[],
): number {
  return challenges.reduce((sum, item) => sum + challengeWeight(item.level), 0);
}

export function formatWeightedScore(score: number): string {
  return `${Number(score.toFixed(2)).toLocaleString("ko-KR")}점`;
}

/**
 * 익명 라벨 생성: "챌린저 01", "챌린저 31" 등 두 자리 0-pad.
 * 운영자가 수강생 등록 시 발급한 anonymous_index를 받아 변환한다.
 */
export function makeAnonymousLabel(index: number): string {
  const padded = String(Math.trunc(index)).padStart(2, "0");
  return `챌린저 ${padded}`;
}

/**
 * 진행률 % 계산. (completed / total) * 100, 반올림된 정수.
 * total이 0이면 0% 반환(0으로 나누기 회피).
 */
export function calculateProgressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  const ratio = (completed / total) * 100;
  return Math.round(ratio);
}

/**
 * 공개 페이지 정렬: weightedScore DESC, tiebreak anonymousLabel ASC.
 * 입력 배열을 직접 변형하지 않는다.
 */
export function sortParticipantsForPublic<T extends PublicParticipant>(
  participants: readonly T[],
): T[] {
  return [...participants].sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) {
      return b.weightedScore - a.weightedScore;
    }
    return a.anonymousLabel.localeCompare(b.anonymousLabel, "ko");
  });
}

/**
 * 관리자 페이지 정렬: weightedScore ASC(독려 대상 먼저), tiebreak nickname ASC.
 * 입력 배열을 직접 변형하지 않는다.
 */
export function sortParticipantsForAdmin<T extends AdminParticipant>(
  participants: readonly T[],
): T[] {
  return [...participants].sort((a, b) => {
    if (a.weightedScore !== b.weightedScore) {
      return a.weightedScore - b.weightedScore;
    }
    return a.nickname.localeCompare(b.nickname, "ko");
  });
}

/**
 * 전체 가중 점수 기준 순위. 같은 점수는 같은 등수로 처리한다(competition ranking).
 */
export function rankParticipant(
  participantId: string,
  participants: readonly RankableParticipant[],
): ParticipantRank | null {
  const me = participants.find((p) => p.id === participantId);
  if (!me) return null;

  const aheadCount = participants.filter((p) => p.weightedScore > me.weightedScore).length;
  const tiedCount = participants.filter((p) => p.weightedScore === me.weightedScore).length;
  return {
    rank: aheadCount + 1,
    total: participants.length,
    tiedCount,
    aheadCount,
  };
}

/**
 * 진행률에 따른 응원 메시지. 100%면 완주 메시지, 그 외엔 단계별 격려.
 */
export function getMotivationalMessage(progressPercent: number): string {
  const p = Math.max(0, Math.min(100, Math.round(progressPercent)));
  if (p >= 100) return "🎉 완주를 축하합니다! 끝까지 해낸 당신, 멋져요.";
  if (p >= 75) return "거의 다 왔어요. 마지막 스퍼트!";
  if (p >= 50) return "절반을 넘겼습니다. 흐름을 유지하세요.";
  if (p >= 25) return "기지개를 켜요. 한 챌린지씩 차근차근.";
  return "시작이 반입니다. 오늘 하나만 체크해볼까요?";
}

/**
 * 다음 익명 번호 계산. 기존 anonymous_index 목록의 max+1, 비어있으면 1.
 * null·음수·NaN은 무시. 수강생 등록 시 운영자에게 자동 부여.
 */
export function nextAnonymousIndex(existing: readonly (number | null | undefined)[]): number {
  let max = 0;
  for (const v of existing) {
    if (typeof v === "number" && Number.isFinite(v) && v > max) {
      max = Math.trunc(v);
    }
  }
  return max + 1;
}
