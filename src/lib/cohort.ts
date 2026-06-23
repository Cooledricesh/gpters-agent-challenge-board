/**
 * cohort.ts — 현재 운영 중인 기수.
 *
 * 라이브 보드(/)의 제목·메타데이터·푸터가 이 값을 쓴다. 다음 기수로 넘어갈 때
 * 이 한 줄만 바꾸면 된다. 종료된 기수는 /archive/<n> 의 정적 스냅샷으로 보존된다.
 */
export const CURRENT_COHORT = "23기";

/** 종료되어 아카이브로 보존 중인 기수(최신 → 과거). 홈/네비 링크 노출용. */
export const ARCHIVED_COHORTS = ["22"] as const;
