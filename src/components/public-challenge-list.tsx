"use client";

/**
 * public-challenge-list.tsx — 공개 홈의 챌린지별 완료 현황(클릭 → 읽기 전용 상세 모달).
 * 로그인 없이 누구나 상세 설명 + 22기 선배 사례를 볼 수 있다. 완료 토글은 없다(/my 전용).
 */

import { useState } from "react";

import { ProgressBar } from "@/components/board-ui";
import ChallengeExamples from "@/components/challenge-examples";
import { challengeLevelLabel, type ChallengeLevel } from "@/lib/challenges";
import { formatWeightedScore, challengeWeight } from "@/lib/progress";
import type { ChallengeExample } from "@/lib/examples";

export interface PublicChallenge {
  id: string;
  title: string;
  level: ChallengeLevel;
  description: string | null;
  detail: string | null;
  completedCount: number;
  examples: ChallengeExample[];
}

export default function PublicChallengeList({
  challenges,
  totalStudents,
}: {
  challenges: PublicChallenge[];
  totalStudents: number;
}) {
  const [selected, setSelected] = useState<PublicChallenge | null>(null);

  return (
    <>
      <ul className="space-y-2">
        {challenges.map((c) => {
          const percent =
            totalStudents === 0 ? 0 : Math.round((c.completedCount / totalStudents) * 100);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c)}
                className="block w-full rounded border border-zinc-200 bg-white p-3 text-left text-sm transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
                aria-label={`${c.title} 상세 보기`}
              >
                <div className="flex justify-between gap-3">
                  <span className="font-medium">
                    {c.title}
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                      {challengeLevelLabel(c.level)} · {formatWeightedScore(challengeWeight(c.level))}
                    </span>
                    {c.examples.length > 0 && (
                      <span className="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                        사례 {c.examples.length}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-zinc-500">
                    {c.completedCount}/{totalStudents}
                  </span>
                </div>
                <ProgressBar percent={percent} />
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <PublicChallengeModal
          challenge={selected}
          totalStudents={totalStudents}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function PublicChallengeModal({
  challenge,
  totalStudents,
  onClose,
}: {
  challenge: PublicChallenge;
  totalStudents: number;
  onClose: () => void;
}) {
  const detail =
    challenge.detail?.trim() || challenge.description?.trim() || "아직 상세 내용이 등록되지 않았어요.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-challenge-title"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800">
          <div>
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-300">
              {challengeLevelLabel(challenge.level)}
            </p>
            <h3 id="public-challenge-title" className="mt-1 text-lg font-semibold">
              {challenge.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="상세 모달 닫기"
          >
            닫기
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          <p className="whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-200">{detail}</p>
          <p className="mt-4 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
            {challenge.completedCount}/{totalStudents}명 완료
          </p>
          <ChallengeExamples examples={challenge.examples} />
        </div>
      </div>
    </div>
  );
}
