/**
 * apply-curriculum.mjs — 검토·승인된 커리큘럼(curriculum-23.json)으로 challenges를 전면 교체한다.
 *
 * 파괴적 작업. 실행 전 확인 사항:
 *   - 수강생 완료기록이 없는 상태(기수 시작 전)여야 안전하다. completions이 있으면 경고 후 중단.
 *   - challenge_examples는 FK cascade로 함께 삭제됨 → 이후 재매핑·재임포트 필요.
 *
 * 절차(--confirm):
 *   1. 트리 정합성 검증(단일 뿌리, 참조 유효, 사이클 없음, 티어 단조성).
 *   2. 기존 challenges 백업(backups/challenges-<ts>.json) 후 전체 삭제.
 *   3. 새 과제를 위상 순서(부모 먼저)로 삽입하며 key→id 매핑, prerequisite_id 해석.
 *      level은 tier에서 파생(T1→basic, T2/T3→advanced), order_index는 JSON 배열 순서.
 *
 * 사용법:
 *   node scripts/apply-curriculum.mjs            # dry-run (검증+요약만)
 *   node scripts/apply-curriculum.mjs --confirm
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { REPO_ROOT, makeServiceClient, unwrap } from "./lib/cohort-data.mjs";

const confirm = process.argv.slice(2).includes("--confirm");

/** 트리 정합성 검증. 문제 목록을 반환(빈 배열이면 통과). */
export function validateCurriculum(challenges) {
  const problems = [];
  const keys = new Set();
  for (const c of challenges) {
    if (keys.has(c.key)) problems.push(`중복 key: ${c.key}`);
    keys.add(c.key);
    if (![1, 2, 3].includes(c.tier)) problems.push(`잘못된 tier(${c.tier}): ${c.key}`);
    if (!c.title?.trim()) problems.push(`제목 없음: ${c.key}`);
  }
  const roots = challenges.filter((c) => !c.prerequisite);
  if (roots.length !== 1) {
    problems.push(`뿌리는 정확히 1개여야 함(현재 ${roots.length}개: ${roots.map((r) => r.key).join(", ")})`);
  }
  const byKey = new Map(challenges.map((c) => [c.key, c]));
  for (const c of challenges) {
    if (c.prerequisite && !byKey.has(c.prerequisite)) {
      problems.push(`깨진 prerequisite 참조: ${c.key} → ${c.prerequisite}`);
    }
  }
  // 사이클 + 티어 단조성(자식 tier >= 부모 tier)
  for (const c of challenges) {
    const seen = new Set([c.key]);
    let cur = byKey.get(c.prerequisite ?? "");
    while (cur) {
      if (seen.has(cur.key)) {
        problems.push(`사이클 감지: ${c.key} 경로`);
        break;
      }
      seen.add(cur.key);
      cur = byKey.get(cur.prerequisite ?? "");
    }
    const parent = byKey.get(c.prerequisite ?? "");
    if (parent && c.tier < parent.tier) {
      problems.push(`티어 역전: ${c.key}(T${c.tier}) < 부모 ${parent.key}(T${parent.tier})`);
    }
  }
  return problems;
}

/** 부모 먼저 오는 위상 순서로 정렬(삽입 시 prerequisite_id 해석 가능하게). */
export function topologicalOrder(challenges) {
  const byKey = new Map(challenges.map((c) => [c.key, c]));
  const visited = new Set();
  const out = [];
  function visit(c) {
    if (visited.has(c.key)) return;
    if (c.prerequisite) visit(byKey.get(c.prerequisite));
    visited.add(c.key);
    out.push(c);
  }
  for (const c of challenges) visit(c);
  return out;
}

async function main() {
  const curriculum = JSON.parse(
    readFileSync(resolve(REPO_ROOT, "scripts", "data", "curriculum-23.json"), "utf8"),
  );
  const items = curriculum.challenges;

  const problems = validateCurriculum(items);
  if (problems.length) {
    console.error("❌ 커리큘럼 정합성 실패:");
    for (const p of problems) console.error("   -", p);
    process.exit(1);
  }
  const tiers = { 1: 0, 2: 0, 3: 0 };
  items.forEach((c) => { tiers[c.tier] += 1; });
  const maxScore = tiers[1] * 1 + tiers[2] * 1.25 + tiers[3] * 1.5;
  console.log(`✅ 정합성 통과: ${items.length}개 (T1 ${tiers[1]} · T2 ${tiers[2]} · T3 ${tiers[3]}) · 만점 ${maxScore}점`);

  const client = makeServiceClient();
  const [existing, completions, examples] = await Promise.all([
    client.from("challenges").select("*").then((r) => unwrap(r, "challenges")),
    client.from("completions").select("id").then((r) => unwrap(r, "completions")),
    client.from("challenge_examples").select("id").then((r) => unwrap(r, "challenge_examples")),
  ]);

  console.log(`현재 DB: 과제 ${existing.length}개 · 완료기록 ${completions.length}건 · 사례 ${examples.length}건(cascade 삭제 예정)`);

  if (completions.length > 0) {
    console.error("❌ 완료기록이 존재합니다. 기수 진행 중 교체는 위험하므로 중단합니다.");
    process.exit(1);
  }

  if (!confirm) {
    console.log("\n⚠️ dry-run입니다. 실제 교체하려면 --confirm 을 붙이세요.");
    return;
  }

  // 백업
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = resolve(REPO_ROOT, "backups");
  mkdirSync(backupDir, { recursive: true });
  const backupPath = resolve(backupDir, `challenges-${stamp}.json`);
  writeFileSync(backupPath, `${JSON.stringify({ challenges: existing }, null, 2)}\n`, "utf8");
  console.log(`💾 기존 과제 백업: ${backupPath}`);

  // 전체 삭제 (challenge_examples는 cascade)
  const del = await client.from("challenges").delete().not("id", "is", null);
  if (del.error) throw new Error(`기존 과제 삭제 실패: ${del.error.message}`);

  // 위상 순서 삽입: 부모 먼저 → prerequisite_id 즉시 해석 가능
  const ordered = topologicalOrder(items);
  const orderIndexByKey = new Map(items.map((c, i) => [c.key, (i + 1) * 10]));
  const idByKey = new Map();
  for (const c of ordered) {
    const row = {
      title: c.title,
      description: c.description ?? null,
      detail: c.detail ?? null,
      level: c.tier === 1 ? "basic" : "advanced",
      area: c.area ?? null,
      tier: c.tier,
      prerequisite_id: c.prerequisite ? idByKey.get(c.prerequisite) : null,
      order_index: orderIndexByKey.get(c.key),
    };
    const ins = await client.from("challenges").insert(row).select("id").single();
    if (ins.error) throw new Error(`삽입 실패(${c.key}): ${ins.error.message}`);
    idByKey.set(c.key, ins.data.id);
  }

  console.log(`\n✅ 23기 커리큘럼 적용 완료: ${idByKey.size}개 과제.`);
  console.log("   다음 단계: prep-mapping → 재매핑 워크플로우 → import-case-studies 로 사례를 재적재하세요.");
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isDirectRun) {
  main().catch((err) => {
    console.error("❌ 적용 실패:", err.message);
    process.exit(1);
  });
}
