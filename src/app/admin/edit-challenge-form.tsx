"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ChallengeLevel } from "@/lib/challenges";

export default function EditChallengeForm({
  id,
  initialTitle,
  initialDescription,
  initialDetail,
  initialLevel,
}: {
  id: string;
  initialTitle: string;
  initialDescription: string | null;
  initialDetail: string | null;
  initialLevel: ChallengeLevel;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [detail, setDetail] = useState(initialDetail ?? "");
  const [level, setLevel] = useState<ChallengeLevel>(initialLevel);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setTitle(initialTitle);
    setDescription(initialDescription ?? "");
    setDetail(initialDetail ?? "");
    setLevel(initialLevel);
    setError(null);
    setInfo(null);
    setEditing(false);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/challenges", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            title: title.trim(),
            description: description.trim() || null,
            detail: detail.trim() || null,
            level,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error ?? "수정 실패");
          return;
        }
        setInfo("수정 완료");
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류");
      }
    });
  };

  if (!editing) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          수정
        </button>
        {info && <p className="text-right text-xs text-green-600">{info}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mt-3 flex flex-col gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/60">
      <input
        type="text"
        required
        maxLength={200}
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
        placeholder="짧은 설명 (선택) — 보드에 바로 보이는 요약"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <textarea
        rows={5}
        maxLength={5000}
        placeholder="상세 내용 (선택) — 클릭 시 모달에 표시할 수행 방법, 완료 기준, 예시 등"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {error && <p className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}
