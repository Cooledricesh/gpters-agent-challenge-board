import type { DataRepository, ExampleDataRow } from "@/lib/data/types";

export interface ChallengeExample {
  id: string;
  challengeId: string;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  sourceAuthor: string | null;
}

function mapRow(row: ExampleDataRow): ChallengeExample {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    title: row.title,
    summary: row.summary,
    sourceUrl: row.source_url,
    sourceAuthor: row.source_author,
  };
}

/** challenge_id → 사례 목록. 해당 backend에서 사례 조회 실패 시 빈 Map. */
export async function loadExamplesByChallenge(
  repository: Pick<DataRepository, "listExamples">,
): Promise<Map<string, ChallengeExample[]>> {
  try {
    return groupExamplesByChallenge((await repository.listExamples()).map(mapRow));
  } catch {
    return new Map();
  }
}

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
