/**
 * prep-mapping.mjs — 매핑 워크플로우 준비물 생성.
 *
 *   1. DB에서 챌린지 목록(id·title·level·area)을 scripts/data/challenges.json 으로 덤프.
 *      (매핑 에이전트의 타깃 목록 + 임포트 단계의 title→id 해석에 재사용)
 *   2. scripts/data/case-meta.json 을 배치 파일 scripts/data/case-batches/batch-NN.json 로 분할.
 *
 * 사용법: node scripts/prep-mapping.mjs [--batch-size 8]
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { REPO_ROOT, makeServiceClient, unwrap } from "./lib/cohort-data.mjs";

function parseArgs(argv) {
  let batchSize = 8;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--batch-size") {
      batchSize = Number(argv[i + 1]);
      i += 1;
    }
  }
  return { batchSize };
}

async function main() {
  const { batchSize } = parseArgs(process.argv.slice(2));
  const dataDir = resolve(REPO_ROOT, "scripts", "data");
  mkdirSync(dataDir, { recursive: true });

  // 1. 챌린지 목록 덤프. 매핑은 제목이 아니라 description/detail(완료 기준)을 근거로 한다.
  const client = makeServiceClient();
  const challenges = await client
    .from("challenges")
    .select("id, title, tier, area, description, detail, order_index")
    .order("tier", { ascending: true })
    .order("order_index", { ascending: true })
    .then((r) => unwrap(r, "challenges"));
  writeFileSync(
    resolve(dataDir, "challenges.json"),
    `${JSON.stringify(challenges, null, 2)}\n`,
    "utf8",
  );
  console.log(`✅ challenges.json: ${challenges.length}개`);

  // 2. case-meta 배치 분할.
  const notes = JSON.parse(readFileSync(resolve(dataDir, "case-meta.json"), "utf8"));
  const batchDir = resolve(dataDir, "case-batches");
  rmSync(batchDir, { recursive: true, force: true });
  mkdirSync(batchDir, { recursive: true });

  let batchCount = 0;
  for (let i = 0; i < notes.length; i += batchSize) {
    const batch = notes.slice(i, i + batchSize);
    const name = `batch-${String(batchCount).padStart(2, "0")}.json`;
    writeFileSync(resolve(batchDir, name), `${JSON.stringify(batch, null, 2)}\n`, "utf8");
    batchCount += 1;
  }
  console.log(`✅ case-batches: ${notes.length}건 → ${batchCount}개 배치 (배치당 최대 ${batchSize})`);
}

main().catch((err) => {
  console.error("❌ prep 실패:", err.message);
  process.exit(1);
});
