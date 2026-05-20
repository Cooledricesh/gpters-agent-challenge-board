"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ChallengeItem {
  id: string;
  title: string;
  description: string | null;
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

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
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
                onChange={(e) => toggle(it.id, e.target.checked)}
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
    </div>
  );
}
