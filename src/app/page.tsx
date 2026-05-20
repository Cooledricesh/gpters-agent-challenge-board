/**
 * 공개 페이지 — 닉네임 노출 금지, 익명 라벨 + 가중 점수 높은 순.
 *
 * 데이터 소스: Supabase service client (RLS 우회). 익명 정보만 추출.
 * SSR: 매 요청마다 최신 진척도. 캐시 안 함.
 */

import { getCurrentSession } from "@/lib/session";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { countCompletionsByChallenge } from "@/lib/challenge-insights";
import { challengeLevelLabel } from "@/lib/challenges";
import { loadChallengesOrdered } from "@/lib/load-challenges";
import { formatWeightedScore, challengeWeight } from "@/lib/progress";
import { loadAllStudentProgress, toPublicView } from "@/lib/stats";

export const dynamic = "force-dynamic";

interface PublicData {
  appName: string;
  totalStudents: number;
  totalChallenges: number;
  totalCompletions: number;
  avgWeightedScore: number;
  totalWeightedScore: number;
  currentUserId: string | null;
  participants: {
    id: string;
    anonymousLabel: string;
    progressPercent: number;
    weightedScore: number;
  }[];
  challenges: {
    title: string;
    level: "basic" | "advanced";
    completedCount: number;
  }[];
}

async function loadPublicData(): Promise<{ data: PublicData | null; error: string | null }> {
  try {
    const client = getSupabaseServiceClient();
    const session = await getCurrentSession();
    const [{ data: challenges, error: challengeError }, { data: completions, error: coErr }, students] =
      await Promise.all([
        loadChallengesOrdered(client),
        client.from("completions").select("challenge_id"),
        loadAllStudentProgress(client),
      ]);
    if (challengeError) throw challengeError;
    if (coErr) throw coErr;

    const participants = toPublicView(students);
    const totalStudents = students.length;
    const totalChallenges = challenges.length;
    const totalCompletions = students.reduce((s, r) => s + r.completedCount, 0);
    const totalWeightedScore = students[0]?.totalWeightedScore ?? 0;
    const avgWeightedScore =
      totalStudents === 0
        ? 0
        : students.reduce((s, r) => s + r.weightedScore, 0) / totalStudents;

    const byChallenge = countCompletionsByChallenge(
      (completions ?? []) as { challenge_id: string }[],
    );
    const challengeStats = challenges.map((c) => ({
      title: c.title,
      level: c.level,
      completedCount: byChallenge.get(c.id) ?? 0,
    }));

    return {
      data: {
        appName: "지피터스 반려 에이전트 챌린지 보드",
        totalStudents,
        totalChallenges,
        totalCompletions,
        avgWeightedScore,
        totalWeightedScore,
        currentUserId: session?.role === "student" ? session.sub : null,
        participants,
        challenges: challengeStats,
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return { data: null, error: message };
  }
}

export default async function HomePage() {
  const { data, error } = await loadPublicData();

  if (error || !data) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <h1 className="text-2xl font-semibold">지피터스 반려 에이전트 챌린지 보드</h1>
        <p className="text-sm text-zinc-500">
          데이터를 불러오지 못했습니다. Supabase 환경변수와 schema 적용 여부를 확인하세요.
        </p>
        <pre className="max-w-md whitespace-pre-wrap rounded bg-zinc-100 p-3 text-left text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {error ?? "no data"}
        </pre>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{data.appName}</h1>
        <p className="text-sm text-zinc-500">
          공개 순위에서는 닉네임이 보이지 않습니다. 기본 과제는 1점, 고급 과제는 1.25점으로 계산해요.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatsCard label="참여자" value={`${data.totalStudents}명`} />
        <StatsCard label="챌린지" value={`${data.totalChallenges}개`} />
        <StatsCard label="완료 누적" value={`${data.totalCompletions}회`} />
        <StatsCard label="평균 가중 점수" value={formatWeightedScore(data.avgWeightedScore)} />
      </section>

      <section className="rounded border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-900 dark:border-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-100">
        <h2 className="font-semibold">가중치 안내</h2>
        <p className="mt-1 text-xs leading-5">
          기본 과제는 <strong>1점</strong>, 고급 과제는 <strong>1.25점</strong>입니다.
          전체 순위는 완료 개수가 아니라 이 가중 점수가 높은 순으로 표시됩니다.
          현재 전체 만점은 <strong>{formatWeightedScore(data.totalWeightedScore)}</strong>입니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">참여자 가중 점수 순위</h2>
        {data.participants.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 등록된 참여자가 없습니다.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.participants.map((p, index) => {
              const isCurrent = data.currentUserId === p.id;
              return (
                <li
                  key={p.anonymousLabel}
                  className={`rounded border p-3 ${
                    isCurrent
                      ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium">
                      <span className="mr-2 text-zinc-400">#{index + 1}</span>
                      {p.anonymousLabel}
                      {isCurrent && <span className="ml-1 text-indigo-600 dark:text-indigo-300">(본인)</span>}
                    </span>
                    <span className="tabular-nums text-zinc-500">{formatWeightedScore(p.weightedScore)}</span>
                  </div>
                  <ProgressBar percent={p.progressPercent} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">챌린지별 완료 현황</h2>
        {data.challenges.length === 0 ? (
          <p className="text-sm text-zinc-500">등록된 챌린지가 아직 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {data.challenges.map((c) => {
              const percent =
                data.totalStudents === 0
                  ? 0
                  : Math.round((c.completedCount / data.totalStudents) * 100);
              return (
                <li
                  key={`${c.level}-${c.title}`}
                  className="rounded border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">
                      {c.title}
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                        {challengeLevelLabel(c.level)} · {formatWeightedScore(challengeWeight(c.level))}
                      </span>
                    </span>
                    <span className="text-zinc-500">
                      {c.completedCount}/{data.totalStudents}
                    </span>
                  </div>
                  <ProgressBar percent={percent} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatsCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div
        className="h-full bg-indigo-500 transition-[width]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
