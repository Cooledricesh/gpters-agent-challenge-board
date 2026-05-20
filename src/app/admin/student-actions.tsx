"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function StudentActions({ id, nickname }: { id: string; nickname: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changePassword = () => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/students", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, password }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error ?? "비밀번호 변경 실패");
          return;
        }
        setPassword("");
        setInfo("변경 완료");
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류");
      }
    });
  };

  const deleteStudent = () => {
    if (!window.confirm(`${nickname} 수강생을 삭제할까요? 체크 기록도 함께 삭제됩니다.`)) return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/students", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error ?? "삭제 실패");
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류");
      }
    });
  };

  return (
    <div className="flex min-w-56 flex-col gap-1.5">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="새 비밀번호"
          className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          disabled={pending || password.length === 0}
          onClick={changePassword}
          className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          변경
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={deleteStudent}
          className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/40"
        >
          삭제
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {info && <p className="text-xs text-green-600">{info}</p>}
    </div>
  );
}
