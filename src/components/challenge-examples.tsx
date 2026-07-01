/**
 * challenge-examples.tsx — 챌린지 상세의 "선배 사례" 섹션(공유).
 * /my 모달과 공개 홈 모달이 동일 UI를 쓴다. 사례 없으면 아무것도 렌더하지 않는다.
 */

import type { ChallengeExample } from "@/lib/examples";

export default function ChallengeExamples({ examples }: { examples: ChallengeExample[] }) {
  if (examples.length === 0) return null;

  return (
    <section className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold">
        <span>🧭</span> 22기 선배 사례
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-normal text-zinc-500 dark:bg-zinc-800">
          {examples.length}
        </span>
      </h4>
      <p className="mt-1 text-xs text-zinc-500">선배들이 이 과제를 실제로 어떻게 해냈는지 원문에서 확인해보세요.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {examples.map((ex) => {
          const inner = (
            <>
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-indigo-700 group-hover:underline dark:text-indigo-300">
                  {ex.title}
                </span>
                {ex.sourceUrl && (
                  <span className="shrink-0 text-[11px] text-zinc-400">원문 ↗</span>
                )}
              </div>
              {ex.sourceAuthor && (
                <p className="mt-0.5 text-[11px] text-zinc-500">by {ex.sourceAuthor}</p>
              )}
              {ex.summary && (
                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{ex.summary}</p>
              )}
            </>
          );
          const cardClass =
            "group block rounded-lg border border-zinc-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800";
          return (
            <li key={ex.id}>
              {ex.sourceUrl ? (
                <a href={ex.sourceUrl} target="_blank" rel="noopener noreferrer" className={cardClass}>
                  {inner}
                </a>
              ) : (
                <div className={cardClass}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
