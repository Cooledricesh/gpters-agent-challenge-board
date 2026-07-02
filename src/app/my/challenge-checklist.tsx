"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  challengeTierLabel,
  groupChallengesForTree,
  type ChallengeAreaKey,
  type ChallengeLevel,
  type ChallengeTier,
} from "@/lib/challenges";
import { challengeCompletionInsight } from "@/lib/challenge-insights";
import type { ChallengeExample } from "@/lib/examples";
import ChallengeExamples from "@/components/challenge-examples";
import { TierBadge, PrereqNotice } from "@/components/tech-tree-ui";

interface ChallengeItem {
  id: string;
  title: string;
  description: string | null;
  detail: string | null;
  level: ChallengeLevel;
  area: ChallengeAreaKey | null;
  tier: ChallengeTier;
  prerequisiteId: string | null;
  completedCount: number;
  totalStudents: number;
  done: boolean;
  examples: ChallengeExample[];
}

/** 선행 과제 표시용 파생 정보. items 상태에서 매번 계산해 낙관적 토글에도 즉시 반영된다. */
interface PrereqInfo {
  title: string;
  done: boolean;
}

function buildPrereqInfo(items: readonly ChallengeItem[]): Map<string, PrereqInfo> {
  const byId = new Map(items.map((it) => [it.id, it]));
  const map = new Map<string, PrereqInfo>();
  for (const it of items) {
    if (!it.prerequisiteId) continue;
    const parent = byId.get(it.prerequisiteId);
    if (parent) map.set(it.id, { title: parent.title, done: parent.done });
  }
  return map;
}

export default function ChallengeChecklist({ initial }: { initial: ChallengeItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [selected, setSelected] = useState<ChallengeItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggle = (id: string, nextDone: boolean) => {
    setError(null);
    setPendingId(id);
    // optimistic: 체크 즉시 개인 화면의 과제별 완료 인원도 반영한다.
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id || it.done === nextDone) return it;
        const delta = nextDone ? 1 : -1;
        return {
          ...it,
          done: nextDone,
          completedCount: Math.max(0, Math.min(it.totalStudents, it.completedCount + delta)),
        };
      }),
    );
    setSelected((prev) => {
      if (!prev || prev.id !== id || prev.done === nextDone) return prev;
      const delta = nextDone ? 1 : -1;
      return {
        ...prev,
        done: nextDone,
        completedCount: Math.max(0, Math.min(prev.totalStudents, prev.completedCount + delta)),
      };
    });
    startTransition(async () => {
      try {
        const res = await fetch("/api/my/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId: id, done: nextDone }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          // rollback
          setItems((prev) =>
            prev.map((it) => {
              if (it.id !== id || it.done !== nextDone) return it;
              const delta = nextDone ? -1 : 1;
              return {
                ...it,
                done: !nextDone,
                completedCount: Math.max(0, Math.min(it.totalStudents, it.completedCount + delta)),
              };
            }),
          );
          setSelected((prev) => {
            if (!prev || prev.id !== id || prev.done !== nextDone) return prev;
            const delta = nextDone ? -1 : 1;
            return {
              ...prev,
              done: !nextDone,
              completedCount: Math.max(0, Math.min(prev.totalStudents, prev.completedCount + delta)),
            };
          });
          setError(json.error ?? "토글 실패");
        } else {
          router.refresh();
        }
      } catch (err) {
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== id || it.done !== nextDone) return it;
            const delta = nextDone ? -1 : 1;
            return {
              ...it,
              done: !nextDone,
              completedCount: Math.max(0, Math.min(it.totalStudents, it.completedCount + delta)),
            };
          }),
        );
        setSelected((prev) => {
          if (!prev || prev.id !== id || prev.done !== nextDone) return prev;
          const delta = nextDone ? -1 : 1;
          return {
            ...prev,
            done: !nextDone,
            completedCount: Math.max(0, Math.min(prev.totalStudents, prev.completedCount + delta)),
          };
        });
        setError(err instanceof Error ? err.message : "네트워크 오류");
      } finally {
        setPendingId(null);
      }
    });
  };

  const sections = groupChallengesForTree(items);
  const prereqInfo = buildPrereqInfo(items);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      <p className="rounded-lg bg-indigo-50/70 px-3 py-2 text-xs leading-5 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">
        🌳 과제는 기술트리로 이어져 있어요. 흐리게 보이는 과제는 <strong>선행 과제를 먼저 하면 훨씬 수월</strong>하다는 안내일 뿐,
        순서를 알고 있다면 바로 체크해도 됩니다. T1 1점 · T2 1.25점 · T3 1.5점.
      </p>
      {sections.map((section) => (
        <ChallengeSection
          key={section.key}
          title={section.label}
          subtitle={section.description}
          items={section.items}
          prereqInfo={prereqInfo}
          pendingId={pendingId}
          onToggle={toggle}
          onSelect={setSelected}
        />
      ))}
      {selected && (
        <ChallengeDetailModal
          item={selected}
          prereq={prereqInfo.get(selected.id) ?? null}
          pending={pendingId === selected.id}
          onClose={() => setSelected(null)}
          onToggle={(nextDone) => toggle(selected.id, nextDone)}
        />
      )}
    </div>
  );
}

function ChallengeSection({
  title,
  subtitle,
  items,
  prereqInfo,
  pendingId,
  onToggle,
  onSelect,
}: {
  title: string;
  subtitle: string;
  items: ChallengeItem[];
  prereqInfo: Map<string, PrereqInfo>;
  pendingId: string | null;
  onToggle: (id: string, nextDone: boolean) => void;
  onSelect: (item: ChallengeItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
          {items.length}개
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((it) => {
          const isPending = pendingId === it.id;
          const prereq = prereqInfo.get(it.id) ?? null;
          // 소프트 잠금: 선행 미완료면 흐리게만 표시. 체크는 여전히 가능하다.
          const softLocked = prereq !== null && !prereq.done && !it.done;
          const insight = challengeCompletionInsight({
            completedCount: it.completedCount,
            totalStudents: it.totalStudents,
            done: it.done,
          });
          return (
            <li
              key={it.id}
              className={`flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-900 dark:hover:bg-indigo-950/20 ${
                softLocked ? "opacity-55 hover:opacity-100" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={it.done}
                disabled={isPending}
                onChange={(e) => onToggle(it.id, e.target.checked)}
                className="mt-1 size-5 accent-indigo-600"
                aria-label={`${it.title} 완료 여부`}
              />
              <button
                type="button"
                onClick={() => onSelect(it)}
                className="flex-1 text-left"
                aria-label={`${it.title} 상세 내용 보기`}
              >
                <div className={`text-sm font-medium ${it.done ? "text-zinc-400 line-through" : ""}`}>
                  <TierBadge tier={it.tier} />
                  <span className="ml-1.5">{it.title}</span>
                </div>
                {it.description && (
                  <p className="mt-0.5 whitespace-pre-line text-xs text-zinc-500">
                    {it.description}
                  </p>
                )}
                {prereq && <PrereqNotice title={prereq.title} done={prereq.done} />}
                <p className="mt-2 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                  {insight}
                </p>
                <p className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-300">클릭해서 상세 보기</p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ChallengeDetailModal({
  item,
  prereq,
  pending,
  onClose,
  onToggle,
}: {
  item: ChallengeItem;
  prereq: PrereqInfo | null;
  pending: boolean;
  onClose: () => void;
  onToggle: (nextDone: boolean) => void;
}) {
  const detail = item.detail?.trim() || item.description?.trim() || "아직 상세 내용이 등록되지 않았어요.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="challenge-detail-title"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800">
          <div>
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-300">
              {challengeTierLabel(item.tier)}
            </p>
            <h3 id="challenge-detail-title" className="mt-1 text-lg font-semibold">
              {item.title}
            </h3>
            {prereq && <PrereqNotice title={prereq.title} done={prereq.done} />}
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
        <div className="max-h-[55vh] overflow-y-auto p-4">
          <p className="whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-200">{detail}</p>
          <p className="mt-4 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
            {item.completedCount}/{item.totalStudents}명 완료
          </p>
          <ChallengeExamples examples={item.examples} />
        </div>
        <div className="flex gap-2 border-t border-zinc-100 p-4 dark:border-zinc-800">
          <button
            type="button"
            disabled={pending}
            onClick={() => onToggle(!item.done)}
            className="flex-1 rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {item.done ? "완료 해제" : "완료 체크"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
