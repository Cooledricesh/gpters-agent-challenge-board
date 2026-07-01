/**
 * examples.ts — 챌린지별 "선배 사례글" 로딩.
 *
 * challenge_examples 테이블(scripts/import-case-studies.mjs로 적재)을 읽어
 * challenge_id → 사례 목록 Map으로 그룹핑한다. 챌린지 상세(/, /my)에서 사용.
 *
 * 테이블이 아직 없는 환경(마이그레이션 전)에서도 앱이 깨지지 않도록,
 * 조회 실패 시 빈 Map을 돌려준다(사례 섹션만 비어 보임).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChallengeExample {
  id: string;
  challengeId: string;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  sourceAuthor: string | null;
}

interface RawExampleRow {
  id: string;
  challenge_id: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  source_author: string | null;
}

function mapRow(row: RawExampleRow): ChallengeExample {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    title: row.title,
    summary: row.summary,
    sourceUrl: row.source_url,
    sourceAuthor: row.source_author,
  };
}

/** challenge_id → 사례 목록(order_index 순). 테이블 부재/오류 시 빈 Map. */
export async function loadExamplesByChallenge(
  client: SupabaseClient,
): Promise<Map<string, ChallengeExample[]>> {
  const { data, error } = await client
    .from("challenge_examples")
    .select("id, challenge_id, title, summary, source_url, source_author")
    .order("challenge_id", { ascending: true })
    .order("order_index", { ascending: true });

  if (error) return new Map();
  return groupExamplesByChallenge(((data ?? []) as RawExampleRow[]).map(mapRow));
}

/** 순수 그룹핑(테스트 용이). 입력 순서를 그룹 내에서 유지한다. */
export function groupExamplesByChallenge(
  rows: readonly ChallengeExample[],
): Map<string, ChallengeExample[]> {
  const byChallenge = new Map<string, ChallengeExample[]>();
  for (const row of rows) {
    const bucket = byChallenge.get(row.challengeId) ?? [];
    bucket.push(row);
    byChallenge.set(row.challengeId, bucket);
  }
  return byChallenge;
}
