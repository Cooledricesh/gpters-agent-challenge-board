/**
 * 공개 페이지 — 닉네임 노출 금지, 익명 라벨 + 진척도 높은 순.
 *
 * 데이터 소스: Supabase service client (RLS 우회). 익명 정보만 추출.
 * SSR: 매 요청마다 최신 진척도. 캐시 안 함.
 */

import { getSupabaseServiceClient } from "@/lib/supabase";
import { loadAllStudentProgress, toPublicView } from "@/lib/stats";

export const dynamic = "force-dynamic";

interface ChallengeRow {
  id: string;
  title: string;
  order_index: number;
}

interface PublicData {
  appName: string;
  totalStudents: number;
  totalChallenges: number;
  totalCompletions: number;
  avgPercent: number;
  participants: { anonymousLabel: string; progressPercent: number }[];
  challenges: { title: string; completedCount: number }[];
}

async function loadPublicData(): Promise<{ data: PublicData | null; error: string | null }> {
  try {
    const client = getSupabaseServiceClient();
    const students = await loadAllStudentProgress(client);
    const participants = toPublicView(students);
    const totalStudents = students.length;
    const totalChallenges = students[0]?.totalChallenges ?? 0;
    const totalCompletions = students.reduce((s, r) => s + r.completedCount, 0);
    const avgPercent =
      totalStudents === 0
        ? 0
        : Math.round(
            students.reduce((s, r) => s + r.progressPercent, 0) / totalStudents,
          );

    const { data: challenges, error: chErr } = await client
      .from("challenges")
      .select("id, title, order_index")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    if (chErr) throw chErr;
    const { data: completions, error: coErr } = await client
      .from("completions")
      .select("challenge_id");
    if (coErr) throw coErr;
    const byChallenge = new Map<string, number>();
    for (const row of (completions ?? []) as { challenge_id: string }[]) {
      byChallenge.set(row.challenge_id, (byChallenge.get(row.challenge_id) ?? 0) + 1);
    }
    const challengeStats = ((challenges ?? []) as ChallengeRow[]).map((c) => ({
      title: c.title,
      completedCount: byChallenge.get(c.id) ?? 0,
    }));

    return {
      data: {
        appName: "지피터스 반려 에이전트 챌린지 보드",
        totalStudents,
        totalChallenges,
        totalCompletions,
        avgPercent,
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
          공개 페이지에서는 닉네임이 보이지 않습니다. 익명 라벨과 진척도만 표시돼요.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatsCard label="참여자" value={`${data.totalStudents}명`} />
        <StatsCard label="챌린지" value={`${data.totalChallenges}개`} />
        <StatsCard label="완료 누적" value={`${data.totalCompletions}회`} />
        <StatsCard label="평균 진척도" value={`${data.avgPercent}%`} />
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
                  key={c.title}
                  className="rounded border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{c.title}</span>
                    <span className="text-zinc-500">
                      {c.completedCount}/{data.totalStudents} ({percent}%)
                    </span>
                  </div>
                  <ProgressBar percent={percent} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">참여자 진척도 (높은 순)</h2>
        {data.participants.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 등록된 참여자가 없습니다.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.participants.map((p) => (
              <li
                key={p.anonymousLabel}
                className="rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{p.anonymousLabel}</span>
                  <span className="tabular-nums text-zinc-500">{p.progressPercent}%</span>
                </div>
                <ProgressBar percent={p.progressPercent} />
              </li>
            ))}
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
