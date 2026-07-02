/**
 * view-toggle.tsx — 기술트리/목록 보기 전환 토글. /, /my 공용.
 */

export default function ViewToggle({
  view,
  onChange,
}: {
  view: "tree" | "list";
  onChange: (view: "tree" | "list") => void;
}) {
  const base = "rounded-full px-3 py-1 text-xs font-semibold transition";
  const active = "bg-indigo-600 text-white shadow-sm";
  const inactive = "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800";
  return (
    <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => onChange("tree")}
        aria-pressed={view === "tree"}
        className={`${base} ${view === "tree" ? active : inactive}`}
      >
        🌳 트리 보기
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={view === "list"}
        className={`${base} ${view === "list" ? active : inactive}`}
      >
        📋 목록 보기
      </button>
    </div>
  );
}
