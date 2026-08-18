import type { DataRepository } from "@/lib/data/types";
import {
  normalizeChallengeArea,
  normalizeChallengeLevel,
  normalizeChallengeTier,
  type ChallengeAreaKey,
  type ChallengeLevel,
  type ChallengeTier,
} from "./challenges";

export interface ChallengeRowWithLevel {
  id: string;
  title: string;
  description: string | null;
  detail: string | null;
  order_index: number;
  level: ChallengeLevel;
  area: ChallengeAreaKey | null;
  tier: ChallengeTier;
  prerequisite_id: string | null;
}

export interface RawChallengeRow {
  id: string;
  title: string;
  description: string | null;
  detail?: string | null;
  order_index: number;
  level?: string | null;
  area?: string | null;
  tier?: number | null;
  prerequisite_id?: string | null;
}

export function mapChallenge(row: RawChallengeRow): ChallengeRowWithLevel {
  const level = normalizeChallengeLevel(row.level);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    detail: row.detail ?? null,
    order_index: row.order_index,
    level,
    area: normalizeChallengeArea(row.area),
    tier: row.tier != null ? normalizeChallengeTier(row.tier) : level === "advanced" ? 2 : 1,
    prerequisite_id: row.prerequisite_id ?? null,
  };
}

export function shouldFallbackToLegacyChallengeShape(error: { message?: string; code?: string }): boolean {
  const message = error.message ?? "";
  return ["level", "detail", "area", "tier", "prerequisite_id", "schema cache"].some((value) =>
    message.includes(value),
  );
}

/** Load ordered challenges from the authoritative repository. */
export async function loadChallengesOrdered(
  repository: Pick<DataRepository, "listChallenges">,
): Promise<{ data: ChallengeRowWithLevel[]; error: Error | null; usedLegacyFallback: boolean }> {
  try {
    return { data: await repository.listChallenges(), error: null, usedLegacyFallback: false };
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error : new Error("challenge_load_failed"),
      usedLegacyFallback: false,
    };
  }
}
