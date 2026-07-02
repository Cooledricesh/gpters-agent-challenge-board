/**
 * merge-mapping.mjs — 매핑 워크플로우 파트들을 하나로 병합·검증한다.
 *
 *   - scripts/data/case-map-parts/part-*.json 을 모아 scripts/data/case-study-mapping.json 생성.
 *   - challengeTitle이 challenges.json title과 정확히 일치하는지 검증(불일치 목록화).
 *   - case-meta의 모든 사례글이 매핑에 포함됐는지, 배정 0건 사례글은 없는지 확인.
 *   - 사람이 검토하기 쉽도록 "챌린지별 사례글" 요약을 출력.
 *
 * 사용법: node scripts/merge-mapping.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { REPO_ROOT } from "./lib/cohort-data.mjs";

const dataDir = resolve(REPO_ROOT, "scripts", "data");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main() {
  const challenges = readJson(resolve(dataDir, "challenges.json"));
  const meta = readJson(resolve(dataDir, "case-meta.json"));
  const validTitles = new Set(challenges.map((c) => c.title));
  const metaByFile = new Map(meta.map((m) => [m.file, m]));

  // 파트 병합.
  const partsDir = resolve(dataDir, "case-map-parts");
  const partFiles = readdirSync(partsDir)
    .filter((f) => /^part-\d+\.json$/.test(f))
    .sort();
  const byFile = new Map();
  for (const pf of partFiles) {
    const part = readJson(resolve(partsDir, pf));
    for (const a of part.assignments ?? []) {
      byFile.set(a.file, a); // file 기준 dedup(뒤 파트가 이김; 배치가 겹치지 않으므로 실질 무해)
    }
  }

  // meta 순서대로 정렬된 최종 매핑 구성.
  const mapping = [];
  const invalid = [];
  const unmapped = [];
  const noAssign = [];
  for (const m of meta) {
    const a = byFile.get(m.file);
    if (!a) {
      unmapped.push(m.file);
      continue;
    }
    const challengesForNote = (a.challenges ?? []).filter((c) => {
      if (!validTitles.has(c.challengeTitle)) {
        invalid.push({ file: m.file, title: c.challengeTitle });
        return false;
      }
      return true;
    });
    if (challengesForNote.length === 0) noAssign.push(m.file);
    mapping.push({ file: m.file, title: m.title, assignments: challengesForNote });
  }

  writeFileSync(
    resolve(dataDir, "case-study-mapping.json"),
    `${JSON.stringify(mapping, null, 2)}\n`,
    "utf8",
  );

  // 챌린지별 요약(검토용).
  const byChallenge = new Map();
  for (const entry of mapping) {
    for (const c of entry.assignments) {
      const bucket = byChallenge.get(c.challengeTitle) ?? [];
      bucket.push({ title: entry.title, confidence: c.confidence });
      byChallenge.set(c.challengeTitle, bucket);
    }
  }

  console.log("=== 챌린지별 선배 사례 (검토용) ===");
  for (const ch of challenges) {
    const list = byChallenge.get(ch.title) ?? [];
    const tag = ch.tier ? `T${ch.tier}` : ch.level === "advanced" ? "고급" : "기본";
    console.log(`\n[${tag}] ${ch.title}  (${list.length}건)`);
    for (const it of list) {
      console.log(`   - (${it.confidence}) ${it.title}`);
    }
  }

  const total = mapping.reduce((s, m) => s + m.assignments.length, 0);
  console.log("\n=== 요약 ===");
  console.log(`사례글 ${mapping.length}건 · 배정 ${total}건 · 사례 있는 챌린지 ${byChallenge.size}/${challenges.length}개`);
  console.log(`✅ scripts/data/case-study-mapping.json 저장`);
  if (invalid.length) {
    console.log(`\n⚠️ 유효하지 않은 challengeTitle ${invalid.length}건(자동 제외됨):`);
    for (const iv of invalid) console.log(`   - "${iv.title}"  ← ${iv.file}`);
  }
  if (unmapped.length) console.log(`\n⚠️ 파트에서 누락된 사례글 ${unmapped.length}건: ${unmapped.join(", ")}`);
  if (noAssign.length) console.log(`\n⚠️ 배정 0건 사례글 ${noAssign.length}건: ${noAssign.join(", ")}`);
}

main();
