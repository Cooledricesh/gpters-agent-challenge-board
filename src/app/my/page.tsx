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
  rankParticipant,
  type ParticipantRank,
} from "@/lib/progress";
import { countCompletionsByChallenge } from "@/lib/challenge-insights";
import { loadChallengesOrdered } from "@/lib/load-challenges";
import { loadAllStudentProgress } from "@/lib/stats";
import ChallengeChecklist from "./challenge-checklist";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const session = await requireSession("student");
  if (!session) redirect("/login");

  const client = getSupabaseServiceClient();
  const [
    { data: challengeRows, error: chErr },
    { data: myCompletions, error: myCoErr },
    { data: allCompletions, error: allCoErr },
    allStudents,
  ] = await Promise.all([
    loadChallengesOrdered(client),
    client.from("completions").select("challenge_id").eq("user_id", session.sub),
    client.from("completions").select("challenge_id"),
    loadAllStudentProgress(client),
  ]);

  if (chErr || myCoErr || allCoErr) {
    return (
      <section className="py-12 text-center">
        <p className="text-sm text-red-600">
          데이터 로드 실패: {chErr?.message ?? myCoErr?.message ?? allCoErr?.message}
        </p>
      </section>
    );
  }

  const doneSet = new Set(
    ((myCompletions ?? []) as { challenge_id: string }[]).map((r) => r.challenge_id),
  );
  const completedByChallenge = countCompletionsByChallenge(
    (allCompletions ?? []) as { challenge_id: string }[],
  );
  const totalStudents = allStudents.length;
  const percent = calculateProgressPercent(doneSet.size, challengeRows.length);
  const message = getMotivationalMessage(percent);
  const rank = rankParticipant(session.sub, allStudents);

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

      <PersonalStats
        rank={rank}
        completedCount={doneSet.size}
        totalChallenges={challengeRows.length}
        totalStudents={totalStudents}
      />

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
              completedCount: completedByChallenge.get(c.id) ?? 0,
              totalStudents,
              done: doneSet.has(c.id),
            }))}
          />
        )}
      </section>
    </div>
  );
}

function PersonalStats({
  rank,
  completedCount,
  totalChallenges,
  totalStudents,
}: {
  rank: ParticipantRank | null;
  completedCount: number;
  totalChallenges: number;
  totalStudents: number;
}) {
  const rankMessage = rank
    ? rank.tiedCount > 1
      ? `전체 ${rank.total}명 중 공동 ${rank.rank}위`
      : `전체 ${rank.total}명 중 ${rank.rank}위`
    : "순위 집계 대기 중";
  const chaseMessage = rank
    ? rank.aheadCount === 0
      ? "지금 최상위권이에요!"
      : `앞에 ${rank.aheadCount}명이 있어요`
    : "체크하면 순위가 계산돼요";

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <StatCard label="내 순위" value={rankMessage} hint={chaseMessage} />
      <StatCard
        label="내 완료"
        value={`${completedCount}/${totalChallenges}`}
        hint="체크할수록 공개 순위에도 반영돼요"
      />
      <StatCard
        label="참여 현황"
        value={`${totalStudents}명 참여`}
        hint="과제별 완료 인원은 아래에서 확인"
      />
    </section>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}
