/**
 * /archive/[cohort] — 종료된 기수의 최종 현황(읽기 전용 아카이브).
 *
 * 데이터 소스: src/data/cohort-<n>-archive.json (정적 스냅샷). DB를 조회하지 않으므로
 * 23기 리셋 이후에도 22기 기록이 그대로 보존되고, 더 이상 변하지 않는다.
 * 공개 홈과 달리 로그인 CTA·체크 버튼·"본인" 강조가 없다.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatsCard, ProgressBar } from "@/components/board-ui";
import { challengeLevelLabel } from "@/lib/challenges";
import { formatWeightedScore, challengeWeight } from "@/lib/progress";
import { toArchiveChallengeRows, type CohortArchive } from "@/lib/archive";
import cohort22 from "@/data/cohort-22-archive.json";

// 종료되어 보존 중인 기수만 등록한다. 새 기수가 종료되면 스냅샷을 만들고 여기 추가.
const ARCHIVES: Record<string, CohortArchive> = {
  "22": cohort22 as CohortArchive,
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(ARCHIVES).map((cohort) => ({ cohort }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cohort: string }>;
}): Promise<Metadata> {
  const { cohort } = await params;
  const archive = ARCHIVES[cohort];
  if (!archive) return { title: "아카이브를 찾을 수 없습니다" };
  return {
    title: `지피터스 ${archive.cohort}기 아카이브 · 반려 에이전트 챌린지`,
    description: `지피터스 ${archive.cohort}기 반려 에이전트 챌린지 최종 현황(종료 아카이브).`,
  };
}

export default async function ArchivePage({ params }: { params: Promise<{ cohort: string }> }) {
  const { cohort } = await params;
  const archive = ARCHIVES[cohort];
  if (!archive) notFound();

  const challengeRows = toArchiveChallengeRows(archive);

  return (
    <div className="flex flex-col gap-8 py-4">
      <header className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
          📦 {archive.cohort}기 · 종료 (아카이브)
        </span>
        <h1 className="text-3xl font-bold tracking-tight">
          지피터스 {archive.cohort}기 반려 에이전트 챌린지 보드
        </h1>
        <p className="text-sm text-zinc-500">
          {archive.endedOn} 종료 시점의 최종 현황입니다. 이 페이지는 더 이상 변경되지 않습니다.
        </p>
        <Link href="/" className="w-fit text-sm text-indigo-600 hover:underline dark:text-indigo-300">
          ← 현재 보드로 돌아가기
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatsCard label="참여자" value={`${archive.totals.students}명`} />
        <StatsCard label="챌린지" value={`${archive.totals.challenges}개`} />
        <StatsCard label="완료 누적" value={`${archive.totals.completions}회`} />
        <StatsCard label="평균 가중 점수" value={formatWeightedScore(archive.totals.avgWeightedScore)} />
      </section>

      <section className="rounded border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-900 dark:border-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-100">
        <h2 className="font-semibold">가중치 안내</h2>
        <p className="mt-1 text-xs leading-5">
          기본 과제는 <strong>1점</strong>, 고급 과제는 <strong>1.25점</strong>입니다. 전체 순위는
          완료 개수가 아니라 이 가중 점수가 높은 순으로 표시됩니다. 전체 만점은{" "}
          <strong>{formatWeightedScore(archive.totals.totalWeightedScore)}</strong>이었습니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">참여자 가중 점수 순위</h2>
        {archive.participants.length === 0 ? (
          <p className="text-sm text-zinc-500">참여자 기록이 없습니다.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {archive.participants.map((p, index) => (
              <li
                key={p.anonymousLabel}
                className="rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium">
                    <span className="mr-2 text-zinc-400">#{index + 1}</span>
                    {p.anonymousLabel}
                  </span>
                  <span className="tabular-nums text-zinc-500">
                    {formatWeightedScore(p.weightedScore)}
                  </span>
                </div>
                <ProgressBar percent={p.progressPercent} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">챌린지별 완료 현황</h2>
        {challengeRows.length === 0 ? (
          <p className="text-sm text-zinc-500">등록된 챌린지가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {challengeRows.map((c) => (
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
                    {c.completedCount}/{c.totalStudents}
                  </span>
                </div>
                <ProgressBar percent={c.percent} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
