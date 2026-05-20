"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ChallengeLevel } from "@/lib/challenges";

export default function ChallengeLevelSelect({
  id,
  initialLevel,
}: {
  id: string;
  initialLevel: ChallengeLevel;
}) {
  const router = useRouter();
  const [level, setLevel] = useState<ChallengeLevel>(initialLevel);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const updateLevel = (nextLevel: ChallengeLevel) => {
    const prev = level;
    setLevel(nextLevel);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/challenges", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, level: nextLevel }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setLevel(prev);
          setError(json.error ?? "변경 실패");
          return;
        }
        router.refresh();
      } catch (err) {
        setLevel(prev);
        setError(err instanceof Error ? err.message : "네트워크 오류");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={level}
        disabled={pending}
        onChange={(e) => updateLevel(e.target.value as ChallengeLevel)}
        className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="basic">기본</option>
        <option value="advanced">고급</option>
      </select>
      {error && <p className="text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
