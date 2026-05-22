import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeChallengeArea, normalizeChallengeLevel, type ChallengeAreaKey, type ChallengeLevel } from "./challenges";

export interface ChallengeRowWithLevel {
  id: string;
  title: string;
  description: string | null;
  detail: string | null;
  order_index: number;
  level: ChallengeLevel;
  area: ChallengeAreaKey | null;
}

interface RawChallengeRow {
  id: string;
  title: string;
  description: string | null;
  detail?: string | null;
  order_index: number;
  level?: string | null;
  area?: string | null;
}

function mapChallenge(row: RawChallengeRow): ChallengeRowWithLevel {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    detail: row.detail ?? null,
    order_index: row.order_index,
    level: normalizeChallengeLevel(row.level),
    area: normalizeChallengeArea(row.area),
  };
}

function shouldFallbackToLegacyChallengeShape(error: { message?: string; code?: string }): boolean {
  const message = error.message ?? "";
  return message.includes("level") || message.includes("detail") || message.includes("area") || message.includes("schema cache");
}

export async function loadChallengesOrdered(
  client: SupabaseClient,
): Promise<{ data: ChallengeRowWithLevel[]; error: Error | null; usedLegacyFallback: boolean }> {
  const withDetail = await client
    .from("challenges")
    .select("id, title, description, detail, order_index, level, area")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (!withDetail.error) {
    return {
      data: ((withDetail.data ?? []) as RawChallengeRow[]).map(mapChallenge),
      error: null,
      usedLegacyFallback: false,
    };
  }

  if (!shouldFallbackToLegacyChallengeShape(withDetail.error)) {
    return { data: [], error: withDetail.error, usedLegacyFallback: false };
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
