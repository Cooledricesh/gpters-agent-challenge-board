/**
 * extract-case-meta.mjs — 옵시디언 22기 사례글 노트를 compact JSON으로 추출한다.
 *
 * 사용법:
 *   node scripts/extract-case-meta.mjs
 *   node scripts/extract-case-meta.mjs --dir "/path/to/사례글"
 *
 * 출력: scripts/data/case-meta.json (매핑 워크플로우 입력).
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

import { REPO_ROOT } from "./lib/cohort-data.mjs";
import { parseCaseNote } from "./lib/case-note.mjs";

const DEFAULT_DIR = join(
  homedir(),
  "obsidian",
  "바클라바",
  "30. Permanent Notes",
  "지피터스 스터디",
  "지피터스 22기 반려 에이전트 사례글",
);

function parseArgs(argv) {
  let dir = DEFAULT_DIR;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dir") {
      dir = argv[i + 1];
      i += 1;
    }
  }
  return { dir };
}

function main() {
  const { dir } = parseArgs(process.argv.slice(2));

  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    throw new Error(`사례글 폴더를 찾을 수 없습니다: ${dir}`);
  }

  const notes = [];
  const skipped = [];
  for (const file of files.sort((a, b) => a.localeCompare(b, "ko"))) {
    const raw = readFileSync(join(dir, file), "utf8");
    const parsed = parseCaseNote(raw, file);
    if (parsed) notes.push(parsed);
    else skipped.push(file);
  }

  const outPath = resolve(REPO_ROOT, "scripts", "data", "case-meta.json");
  mkdirSync(resolve(REPO_ROOT, "scripts", "data"), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(notes, null, 2)}\n`, "utf8");

  console.log(`✅ 사례글 메타 추출: ${outPath}`);
  console.log(`   사례글 ${notes.length}건 · 제외 ${skipped.length}건 (${skipped.join(", ") || "-"})`);
  const noSummary = notes.filter((n) => !n.summary).map((n) => n.file);
  const noAuthor = notes.filter((n) => !n.sourceAuthor).map((n) => n.file);
  if (noSummary.length) console.log(`   ⚠️ 요약 없음 ${noSummary.length}건: ${noSummary.join(", ")}`);
  if (noAuthor.length) console.log(`   ⚠️ 원작자 없음 ${noAuthor.length}건: ${noAuthor.join(", ")}`);
}

main();
