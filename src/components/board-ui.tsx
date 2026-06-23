/**
 * board-ui.tsx — 보드 공용 표시 컴포넌트.
 * 공개 홈(/)과 아카이브(/archive/[cohort])가 동일한 통계 카드·진행 막대를 공유한다.
 * 상태가 없는 순수 프레젠테이션 컴포넌트.
 */

export function StatsCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div className="h-full bg-indigo-500 transition-[width]" style={{ width: `${clamped}%` }} />
    </div>
  );
}
