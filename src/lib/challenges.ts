export type ChallengeLevel = "basic" | "advanced";

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
