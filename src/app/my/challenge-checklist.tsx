"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { challengeLevelLabel, groupChallengesByLevel, type ChallengeLevel } from "@/lib/challenges";

interface ChallengeItem {
  id: string;
  title: string;
  description: string | null;
  level: ChallengeLevel;
  done: boolean;
}

export default function ChallengeChecklist({ initial }: { initial: ChallengeItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggle = (id: string, nextDone: boolean) => {
    setError(null);
    setPendingId(id);
    // optimistic
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, done: nextDone } : it)));
    startTransition(async () => {
      try {
        const res = await fetch("/api/my/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId: id, done: nextDone }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          // rollback
          setItems((prev) => prev.map((it) => (it.id === id ? { ...it, done: !nextDone } : it)));
          setError(json.error ?? "토글 실패");
        } else {
          router.refresh();
        }
      } catch (err) {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, done: !nextDone } : it)));
        setError(err instanceof Error ? err.message : "네트워크 오류");
      } finally {
        setPendingId(null);
      }
    });
  };

  const grouped = groupChallengesByLevel(items);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      <ChallengeSection
        title={challengeLevelLabel("basic")}
        subtitle="처음 시작하는 분들을 위한 핵심 챌린지"
        items={grouped.basic}
        pendingId={pendingId}
        onToggle={toggle}
      />
      <ChallengeSection
        title={challengeLevelLabel("advanced")}
        subtitle="조금 더 깊게 해보고 싶은 분들을 위한 확장 챌린지"
        items={grouped.advanced}
        pendingId={pendingId}
        onToggle={toggle}
      />
    </div>
  );
}

function ChallengeSection({
  title,
  subtitle,
  items,
  pendingId,
  onToggle,
}: {
  title: string;
  subtitle: string;
  items: ChallengeItem[];
  pendingId: string | null;
  onToggle: (id: string, nextDone: boolean) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((it) => {
          const isPending = pendingId === it.id;
          return (
            <li
              key={it.id}
              className="flex items-start gap-3 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <input
                type="checkbox"
                checked={it.done}
                disabled={isPending}
                onChange={(e) => onToggle(it.id, e.target.checked)}
                className="mt-1 size-5 accent-indigo-600"
              />
              <div className="flex-1">
                <div className={`text-sm font-medium ${it.done ? "text-zinc-400 line-through" : ""}`}>
                  {it.title}
                </div>
                {it.description && (
                  <p className="mt-0.5 text-xs text-zinc-500 whitespace-pre-line">
                    {it.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
