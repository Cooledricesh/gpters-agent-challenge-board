/**
 * archive.ts — 종료된 기수의 정적 스냅샷(scripts/export-cohort-archive.mjs 산출물) 타입과
 * 화면용 변환 헬퍼. DB를 조회하지 않는다.
 *
 * 스냅샷의 participants/challenges는 이미 정렬되어 있다(export 시점에 확정). 여기서는
 * 표시 전용 파생값(챌린지별 완료율)만 계산한다.
 */

import type { ChallengeLevel } from "./challenges";

export interface CohortArchiveParticipant {
  anonymousLabel: string;
  weightedScore: number;
  progressPercent: number;
}

export interface CohortArchiveChallenge {
  title: string;
  level: ChallengeLevel;
  completedCount: number;
}

export interface CohortArchive {
  cohort: string;
  endedOn: string;
  generatedAt: string;
  totals: {
    students: number;
    challenges: number;
    completions: number;
    avgWeightedScore: number;
    totalWeightedScore: number;
  };
  participants: CohortArchiveParticipant[];
  challenges: CohortArchiveChallenge[];
}

export interface ArchiveChallengeRow extends CohortArchiveChallenge {
  totalStudents: number;
  /** 완료율 % (completedCount / 참여자수). 참여자 0명이면 0. 홈 화면과 동일한 계산. */
  percent: number;
}

/** 챌린지별 완료율을 붙인 표시용 행 목록. 스냅샷의 순서를 그대로 유지한다. */
export function toArchiveChallengeRows(archive: CohortArchive): ArchiveChallengeRow[] {
  const totalStudents = archive.totals.students;
  return archive.challenges.map((c) => ({
    ...c,
    totalStudents,
    percent: totalStudents <= 0 ? 0 : Math.round((c.completedCount / totalStudents) * 100),
  }));
}
