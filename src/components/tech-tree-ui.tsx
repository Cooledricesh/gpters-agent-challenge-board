/**
 * tech-tree-ui.tsx — 기술트리 공용 표시 요소.
 * /my 체크리스트와 공개 홈 리스트가 같은 티어 배지·선행 안내를 쓴다.
 * 상태 없는 순수 프레젠테이션 컴포넌트.
 */

import type { ChallengeTier } from "@/lib/challenges";

const TIER_STYLES: Record<ChallengeTier, string> = {
  1: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  2: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  3: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
};

export function TierBadge({ tier }: { tier: ChallengeTier }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 align-middle text-[11px] font-bold tabular-nums ${TIER_STYLES[tier]}`}
    >
      T{tier}
    </span>
  );
}

/**
 * 선행 과제 안내(소프트 잠금). 미완료면 안내 톤, 완료면 체크 표시.
 * done=null은 완료 정보가 없는 컨텍스트(공개 홈) — 중립 표기.
 */
export function PrereqNotice({ title, done }: { title: string; done: boolean | null }) {
  if (done) {
    return (
      <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
        🔗 선행: {title} ✓
      </p>
    );
  }
  return (
    <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
      🔗 선행: {title}
      {done === false && <span className="ml-1 text-zinc-500">— 먼저 해보면 수월해요</span>}
    </p>
  );
}
