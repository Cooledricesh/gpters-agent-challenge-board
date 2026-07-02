import type { SupabaseClient } from "@supabase/supabase-js";

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
  /** 23기 기술트리 티어. 컬럼 없는 구버전 DB에서는 1로 폴백. */
  tier: ChallengeTier;
  /** 단일 선행과제 id. 뿌리(또는 구버전 DB)는 null. */
  prerequisite_id: string | null;
}

interface RawChallengeRow {
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

function mapChallenge(row: RawChallengeRow): ChallengeRowWithLevel {
  const level = normalizeChallengeLevel(row.level);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    detail: row.detail ?? null,
    order_index: row.order_index,
    level,
    area: normalizeChallengeArea(row.area),
    // tier 컬럼이 없는 구버전 DB에서는 level에서 파생해 가중치(1/1.25)를 보존한다.
    tier: row.tier != null ? normalizeChallengeTier(row.tier) : level === "advanced" ? 2 : 1,
    prerequisite_id: row.prerequisite_id ?? null,
  };
}

function shouldFallbackToLegacyChallengeShape(error: { message?: string; code?: string }): boolean {
  const message = error.message ?? "";
  return (
    message.includes("level") ||
    message.includes("detail") ||
    message.includes("area") ||
    message.includes("tier") ||
    message.includes("prerequisite_id") ||
    message.includes("schema cache")
  );
}

/**
 * 챌린지를 (tier, order_index, created_at) 순으로 로드한다.
 * 신규 컬럼(tier/prerequisite_id)이 없는 DB에서는 단계적으로 폴백한다.
 */
export async function loadChallengesOrdered(
  client: SupabaseClient,
): Promise<{ data: ChallengeRowWithLevel[]; error: Error | null; usedLegacyFallback: boolean }> {
  const withTree = await client
    .from("challenges")
    .select("id, title, description, detail, order_index, level, area, tier, prerequisite_id")
    .order("tier", { ascending: true })
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (!withTree.error) {
    return {
      data: ((withTree.data ?? []) as RawChallengeRow[]).map(mapChallenge),
      error: null,
      usedLegacyFallback: false,
    };
  }

  if (!shouldFallbackToLegacyChallengeShape(withTree.error)) {
    return { data: [], error: withTree.error, usedLegacyFallback: false };
  }

  const withDetail = await client
    .from("challenges")
    .select("id, title, description, detail, order_index, level, area")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (!withDetail.error) {
    return {
      data: ((withDetail.data ?? []) as RawChallengeRow[]).map(mapChallenge),
      error: null,
      usedLegacyFallback: true,
    };
  }

  if (!shouldFallbackToLegacyChallengeShape(withDetail.error)) {
    return { data: [], error: withDetail.error, usedLegacyFallback: true };
  }

  const withoutDetail = await client
    .from("challenges")
    .select("id, title, description, detail, order_index, level")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (!withoutDetail.error) {
    return {
      data: ((withoutDetail.data ?? []) as RawChallengeRow[]).map(mapChallenge),
      error: null,
      usedLegacyFallback: true,
    };
  }

  if (!shouldFallbackToLegacyChallengeShape(withoutDetail.error)) {
    return { data: [], error: withoutDetail.error, usedLegacyFallback: true };
  }

  const legacy = await client
    .from("challenges")
    .select("id, title, description, order_index")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (legacy.error) {
    return { data: [], error: legacy.error, usedLegacyFallback: true };
  }

  return {
    data: ((legacy.data ?? []) as RawChallengeRow[]).map((row) => mapChallenge({ ...row, level: "basic" })),
    error: null,
    usedLegacyFallback: true,
  };
}
