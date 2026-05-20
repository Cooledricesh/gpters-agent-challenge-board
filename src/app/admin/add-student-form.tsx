"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function AddStudentForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nickname: nickname.trim(), password }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error ?? "등록 실패");
          return;
        }
        setInfo(
          `등록 완료: ${json.student?.nickname ?? nickname} (${json.student?.anonymousLabel ?? ""}). 지정한 비밀번호로 로그인할 수 있어요.`,
        );
        setNickname("");
        setPassword("");
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
        maxLength={64}
        placeholder="수강생 아이디/닉네임"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        type="text"
        required
        minLength={1}
        maxLength={128}
        placeholder="초기 비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <p className="text-xs text-zinc-500">
        관리자가 원하는 아이디와 비밀번호를 직접 정합니다. 비밀번호는 해시로만 저장됩니다.
      </p>
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
        {pending ? "등록 중..." : "수강생 추가"}
      </button>
    </form>
  );
}
