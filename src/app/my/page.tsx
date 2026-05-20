/**
 * 수강생 페이지 — 본인 진척도, 챌린지 체크리스트, 토글 액션.
 *
 * 가드: student 세션 필수. 미세션·관리자는 /login으로.
 * 데이터: 본인의 completions만 한 번에 로드.
 */

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServiceClient } from "@/lib/supabase";
import {
  calculateProgressPercent,
  getMotivationalMessage,
} from "@/lib/progress";
import { loadChallengesOrdered } from "@/lib/load-challenges";
import ChallengeChecklist from "./challenge-checklist";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const session = await requireSession("student");
  if (!session) redirect("/login");

  const client = getSupabaseServiceClient();
  const [{ data: challengeRows, error: chErr }, { data: completions, error: coErr }] =
    await Promise.all([
      loadChallengesOrdered(client),
      client.from("completions").select("challenge_id").eq("user_id", session.sub),
    ]);

  if (chErr || coErr) {
    return (
      <section className="py-12 text-center">
        <p className="text-sm text-red-600">데이터 로드 실패: {chErr?.message ?? coErr?.message}</p>
      </section>
    );
  }

  const doneSet = new Set(
    ((completions ?? []) as { challenge_id: string }[]).map((r) => r.challenge_id),
  );
  const percent = calculateProgressPercent(doneSet.size, challengeRows.length);
  const message = getMotivationalMessage(percent);

  return (
    <div className="flex flex-col gap-6 py-4">
      <header className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-5">
        <p className="text-xs uppercase tracking-wider text-indigo-700/70 dark:text-indigo-300/70">
          내 챌린지
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          {session.nickname} 님, 환영합니다
        </h1>
        <div className="mt-3 flex items-end gap-3">
          <span className="text-4xl font-bold tabular-nums">{percent}%</span>
          <span className="pb-1 text-sm text-zinc-500">
            {doneSet.size} / {challengeRows.length} 완료
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{message}</p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">챌린지</h2>
        {challengeRows.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 등록된 챌린지가 없습니다. 관리자에게 문의하세요.</p>
        ) : (
          <ChallengeChecklist
            initial={challengeRows.map((c) => ({
              id: c.id,
              title: c.title,
              description: c.description,
              level: c.level,
              done: doneSet.has(c.id),
            }))}
          />
        )}
      </section>
    </div>
  );
}
