export type ChallengeLevel = "basic" | "advanced";

export interface EditableChallengeInput {
  title: string;
  description?: string | null;
  detail?: string | null;
  level?: string | null;
}

export interface NormalizedChallengeUpdateInput {
  title: string;
  description: string | null;
  detail: string | null;
  level: ChallengeLevel;
}

export interface ChallengeWithLevel {
  level?: string | null;
}

export function normalizeChallengeLevel(level: string | null | undefined): ChallengeLevel {
  return level === "advanced" ? "advanced" : "basic";
}

export function challengeLevelLabel(level: ChallengeLevel): string {
  return level === "advanced" ? "고급 과제" : "기본 과제";
}

export function groupChallengesByLevel<T extends ChallengeWithLevel>(items: readonly T[]): {
  basic: T[];
  advanced: T[];
} {
  const grouped: { basic: T[]; advanced: T[] } = { basic: [], advanced: [] };
  for (const item of items) {
    grouped[normalizeChallengeLevel(item.level)].push(item);
  }
  return grouped;
}

export function normalizeChallengeUpdateInput(input: EditableChallengeInput): NormalizedChallengeUpdateInput {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    detail: input.detail?.trim() || null,
    level: normalizeChallengeLevel(input.level),
  };
}
