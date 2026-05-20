"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ChallengeLevel } from "@/lib/challenges";

export default function AddChallengeForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<ChallengeLevel>("basic");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/challenges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            level,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error ?? "등록 실패");
          return;
        }
        setInfo(`등록 완료: ${json.challenge?.title ?? title}`);
        setTitle("");
        setDescription("");
        setLevel("basic");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <input
        type="text"
        required
        maxLength={200}
        placeholder="챌린지 제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <select
        value={level}
        onChange={(e) => setLevel(e.target.value as ChallengeLevel)}
        className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="basic">기본 과제</option>
        <option value="advanced">고급 과제</option>
      </select>
      <textarea
        rows={2}
        maxLength={500}
        placeholder="설명 (선택)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {error && (
        <p className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded bg-green-50 px-3 py-1.5 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-300">
          {info}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "등록 중..." : "챌린지 추가"}
      </button>
    </form>
  );
}
