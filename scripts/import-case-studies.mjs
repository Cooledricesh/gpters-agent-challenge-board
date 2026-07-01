/**
 * import-case-studies.mjs — 검토된 매핑을 challenge_examples 테이블에 적재한다.
 *
 * 입력: scripts/data/case-study-mapping.json (검토 완료) + scripts/data/case-meta.json.
 * 동작: cohort='22' 기존 행을 지우고 매핑대로 다시 삽입(idempotent, 재실행 안전).
 *   - 챌린지 제목 → challenge_id 는 DB에서 live 조회(정합성).
 *   - order_index는 챌린지별로 confidence(high→medium→low) 순으로 0..n.
 *
 * 사용법:
 *   node scripts/import-case-studies.mjs            # dry-run
 *   node scripts/import-case-studies.mjs --confirm  # 실제 반영
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { REPO_ROOT, makeServiceClient, unwrap } from "./lib/cohort-data.mjs";

const COHORT = "22";
const CONFIDENCE_RANK = { high: 0, medium: 1, low: 2 };
const confirm = process.argv.slice(2).includes("--confirm");
const dataDir = resolve(REPO_ROOT, "scripts", "data");

function readJson(name) {
  return JSON.parse(readFileSync(resolve(dataDir, name), "utf8"));
}

async function main() {
  const mapping = readJson("case-study-mapping.json");
  const meta = readJson("case-meta.json");
  const metaByFile = new Map(meta.map((m) => [m.file, m]));

  const client = makeServiceClient();
  const challenges = await client
    .from("challenges")
    .select("id, title")
    .then((r) => unwrap(r, "challenges"));
  const idByTitle = new Map(challenges.map((c) => [c.title, c.id]));

  // 매핑 → 행 목록. 챌린지별로 모아 confidence 순 order_index 부여.
  const rowsByChallenge = new Map();
  const missingTitles = [];
  const missingMeta = [];
  for (const entry of mapping) {
    const m = metaByFile.get(entry.file);
    if (!m) {
      missingMeta.push(entry.file);
      continue;
    }
    for (const a of entry.assignments) {
      const challengeId = idByTitle.get(a.challengeTitle);
      if (!challengeId) {
        missingTitles.push({ file: entry.file, title: a.challengeTitle });
        continue;
      }
      const bucket = rowsByChallenge.get(challengeId) ?? [];
      bucket.push({
        challenge_id: challengeId,
        cohort: COHORT,
        title: m.title,
        summary: m.summary,
        source_url: m.sourceUrl,
        source_author: m.sourceAuthor,
        _confidence: a.confidence,
      });
      rowsByChallenge.set(challengeId, bucket);
    }
  }

  const rows = [];
  for (const bucket of rowsByChallenge.values()) {
    bucket.sort(
      (x, y) =>
        (CONFIDENCE_RANK[x._confidence] ?? 9) - (CONFIDENCE_RANK[y._confidence] ?? 9) ||
        x.title.localeCompare(y.title, "ko"),
    );
    bucket.forEach((row, i) => {
      const { _confidence, ...clean } = row;
      rows.push({ ...clean, order_index: i });
    });
  }

  console.log(`매핑 ${mapping.length}건 → 삽입 예정 행 ${rows.length}개 (챌린지 ${rowsByChallenge.size}개)`);
  if (missingTitles.length) {
    console.log(`⚠️ challenge_id 미해석 ${missingTitles.length}건(건너뜀):`);
    for (const mt of missingTitles) console.log(`   - "${mt.title}" ← ${mt.file}`);
  }
  if (missingMeta.length) console.log(`⚠️ case-meta 누락 ${missingMeta.length}건: ${missingMeta.join(", ")}`);

  if (!confirm) {
    console.log("\n⚠️ dry-run입니다. 실제 반영하려면 --confirm 을 붙이세요.");
    return;
  }

  // idempotent: 기존 cohort 행 삭제 후 삽입.
  const del = await client.from("challenge_examples").delete().eq("cohort", COHORT);
  if (del.error) throw new Error(`기존 ${COHORT}기 사례 삭제 실패: ${del.error.message}`);

  const ins = await client.from("challenge_examples").insert(rows);
  if (ins.error) throw new Error(`삽입 실패: ${ins.error.message}`);

  const { count } = await client
    .from("challenge_examples")
    .select("*", { count: "exact", head: true })
    .eq("cohort", COHORT);
  console.log(`\n✅ 적재 완료. challenge_examples(cohort=${COHORT}) 행 수: ${count ?? "?"}`);
}

main().catch((err) => {
  console.error("❌ 임포트 실패:", err.message);
  process.exit(1);
});
