export interface CompletionChallengeRef {
  challenge_id: string;
}

export function countCompletionsByChallenge(
  completions: readonly CompletionChallengeRef[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of completions) {
    counts.set(row.challenge_id, (counts.get(row.challenge_id) ?? 0) + 1);
  }
  return counts;
}

export function challengeCompletionInsight({
  completedCount,
  done,
}: {
  completedCount: number;
  totalStudents: number;
  done: boolean;
}): string {
  if (completedCount <= 0) return "아직 아무도 완료하지 않았어요";
  if (done && completedCount === 1) return "나만 완료했어요! 선두 주자예요 ✨";
  return `${completedCount}명이 완료했어요`;
}
