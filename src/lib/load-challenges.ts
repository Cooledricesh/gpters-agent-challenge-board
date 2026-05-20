import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeChallengeLevel, type ChallengeLevel } from "./challenges";

export interface ChallengeRowWithLevel {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  level: ChallengeLevel;
}

interface RawChallengeRow {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  level?: string | null;
}

function mapChallenge(row: RawChallengeRow): ChallengeRowWithLevel {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    order_index: row.order_index,
    level: normalizeChallengeLevel(row.level),
  };
}

function shouldFallbackToLegacyChallengeShape(error: { message?: string; code?: string }): boolean {
  const message = error.message ?? "";
  return message.includes("level") || message.includes("schema cache");
}

export async function loadChallengesOrdered(
  client: SupabaseClient,
): Promise<{ data: ChallengeRowWithLevel[]; error: Error | null; usedLegacyFallback: boolean }> {
  const withLevel = await client
    .from("challenges")
    .select("id, title, description, order_index, level")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (!withLevel.error) {
    return {
      data: ((withLevel.data ?? []) as RawChallengeRow[]).map(mapChallenge),
      error: null,
      usedLegacyFallback: false,
    };
  }

  if (!shouldFallbackToLegacyChallengeShape(withLevel.error)) {
    return { data: [], error: withLevel.error, usedLegacyFallback: false };
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
