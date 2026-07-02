/**
 * tech-tree-view.tsx — 기술트리 시각화(좌→우, 엘보 연결선).
 * 선행 관계가 연결선으로 한눈에 보이는 뷰. 노드를 누르면 상세(onSelect)가 열린다.
 * 연결선 스타일은 globals.css의 .tt-* 클래스.
 */

import { buildChallengeTree, type TreeNode } from "@/lib/tech-tree";
import type { ChallengeAreaKey, ChallengeTier } from "@/lib/challenges";
import { challengeTierWeight, formatWeightedScore } from "@/lib/progress";

export interface TechTreeItem {
  id: string;
  title: string;
  tier: ChallengeTier;
  area: ChallengeAreaKey | null;
  prerequisiteId: string | null;
  /** 완료 여부. 공개 화면처럼 개인 상태가 없으면 null. */
  done: boolean | null;
  completedCount: number;
  exampleCount: number;
}

const AREA_EMOJI: Record<ChallengeAreaKey, string> = {
  start: "🌱",
  channel: "💬",
  content: "📎",
  automation: "⏰",
  operations: "🛠️",
  integrations: "🔌",
  orchestration: "🤝",
  build: "🧱",
  "voice-ui": "🎙️",
  edge: "⚡",
  other: "✨",
};

const TIER_NODE_STYLES: Record<ChallengeTier, string> = {
  1: "border-emerald-300 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/40",
  2: "border-sky-300 bg-sky-50/80 dark:border-sky-800 dark:bg-sky-950/40",
  3: "border-violet-300 bg-violet-50/80 dark:border-violet-800 dark:bg-violet-950/40",
};

export default function TechTreeView<T extends TechTreeItem>({
  items,
  onSelect,
}: {
  items: T[];
  onSelect: (item: T) => void;
}) {
  const roots = buildChallengeTree(
    items.map((it) => ({ ...it, prerequisiteId: it.prerequisiteId })),
  );
  const doneById = new Map(items.map((it) => [it.id, it.done === true]));

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="min-w-max">
        {roots.map((root) => (
          <TreeBranch key={root.item.id} node={root} doneById={doneById} onSelect={onSelect} />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-zinc-400">
        🟢 T1 기초 · 🔵 T2 활용 · 🟣 T3 심화 — 선을 따라가면 선행 과제예요. 노드를 누르면 상세와 선배 사례가 열립니다.
      </p>
    </div>
  );
}

function TreeBranch<T extends TechTreeItem>({
  node,
  doneById,
  onSelect,
}: {
  node: TreeNode<T & { prerequisiteId: string | null }>;
  doneById: Map<string, boolean>;
  onSelect: (item: T) => void;
}) {
  const it = node.item;
  // 소프트 잠금: 개인 화면(done != null)에서 선행 미완료면 흐리게.
  const softLocked =
    it.done === false && it.prerequisiteId !== null && doneById.get(it.prerequisiteId) === false;

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => onSelect(it)}
        aria-label={`${it.title} 상세 보기`}
        className={`w-48 shrink-0 rounded-xl border-2 px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
          TIER_NODE_STYLES[it.tier]
        } ${it.done ? "ring-2 ring-emerald-400 dark:ring-emerald-600" : ""} ${
          softLocked ? "opacity-50 hover:opacity-100" : ""
        }`}
      >
        <span className="flex items-start gap-1.5">
          <span aria-hidden className="text-sm leading-5">
            {AREA_EMOJI[it.area ?? "other"]}
          </span>
          <span className="line-clamp-2 text-xs font-semibold leading-5">
            {it.done ? <span className="mr-0.5 text-emerald-600 dark:text-emerald-400">✓</span> : null}
            {it.title}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="font-bold tabular-nums">T{it.tier}</span>
          <span>{formatWeightedScore(challengeTierWeight(it.tier))}</span>
          {it.completedCount > 0 && <span>· {it.completedCount}명 완료</span>}
          {it.exampleCount > 0 && (
            <span className="rounded-full bg-indigo-100 px-1.5 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              사례 {it.exampleCount}
            </span>
          )}
        </span>
      </button>

      {node.children.length > 0 && (
        <>
          <div className="tt-stub" aria-hidden />
          <div className="flex flex-col">
            {node.children.map((child) => (
              <div key={child.item.id} className="tt-child">
                <TreeBranch node={child} doneById={doneById} onSelect={onSelect} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
