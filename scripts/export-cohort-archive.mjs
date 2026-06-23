/**
 * export-cohort-archive.mjs — 종료된 기수의 최종 현황을 정적 스냅샷으로 추출한다.
 *
 * 사용법:
 *   node scripts/export-cohort-archive.mjs            # 기본: 22기 → src/data/cohort-22-archive.json
 *   node scripts/export-cohort-archive.mjs --cohort 23
 *
 * 공개 페이지(/)와 동일한 익명 집계를 계산한다. 닉네임 등 개인정보는 절대 담지 않는다.
 * 결과 JSON은 /archive 페이지가 DB 없이 그대로 렌더한다 → 구조적으로 동결.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

import {
  REPO_ROOT,
  makeServiceClient,
  challengeWeight,
  makeAnonymousLabel,
  unwrap,
} from "./lib/cohort-data.mjs";

function parseArgs(argv) {
  let cohort = "22";
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--cohort") {
      cohort = argv[i + 1];
      i += 1;
    }
  }
  return { cohort };
}

function round2(n) {
  return Number(n.toFixed(2));
}

async function main() {
  const { cohort } = parseArgs(process.argv.slice(2));
  const endedOn = new Date().toISOString().slice(0, 10);
  const generatedAt = new Date().toISOString();
  const client = makeServiceClient();

  const [students, challenges, completions] = await Promise.all([
    client
      .from("app_users")
      .select("id, anonymous_index")
      .eq("role", "student")
      .then((r) => unwrap(r, "app_users")),
    client
      .from("challenges")
      .select("id, title, level, order_index, created_at")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true })
      .then((r) => unwrap(r, "challenges")),
    client.from("completions").select("user_id, challenge_id").then((r) => unwrap(r, "completions")),
  ]);

  const levelById = new Map(
    challenges.map((c) => [c.id, c.level === "advanced" ? "advanced" : "basic"]),
  );
  const totalWeightedScore = round2(
    challenges.reduce((sum, c) => sum + challengeWeight(levelById.get(c.id)), 0),
  );

  // 수강생별 가중 점수 + 챌린지별 완료 수 집계.
  const scoreByUser = new Map();
  const completedCountByChallenge = new Map();
  for (const row of completions) {
    const level = levelById.get(row.challenge_id);
    if (level === undefined) continue; // 삭제된 챌린지에 대한 잔여 완료(이론상 cascade로 없음).
    scoreByUser.set(row.user_id, (scoreByUser.get(row.user_id) ?? 0) + challengeWeight(level));
    completedCountByChallenge.set(
      row.challenge_id,
      (completedCountByChallenge.get(row.challenge_id) ?? 0) + 1,
    );
  }

  const participants = students
    .map((u) => {
      const weightedScore = round2(scoreByUser.get(u.id) ?? 0);
      const progressPercent =
        totalWeightedScore <= 0
          ? 0
          : Math.round((weightedScore / totalWeightedScore) * 100);
      return {
        anonymousLabel: u.anonymous_index
          ? makeAnonymousLabel(u.anonymous_index)
          : "챌린저 --",
        weightedScore,
        progressPercent,
      };
    })
    // 공개 정렬: 가중점수 내림차순, tiebreak 라벨 오름차순.
    .sort((a, b) =>
      b.weightedScore !== a.weightedScore
        ? b.weightedScore - a.weightedScore
        : a.anonymousLabel.localeCompare(b.anonymousLabel, "ko"),
    );

  const challengeStats = challenges
    .map((c) => ({
      title: c.title,
      level: c.level === "advanced" ? "advanced" : "basic",
      completedCount: completedCountByChallenge.get(c.id) ?? 0,
    }))
    // 완료수 내림차순.
    .sort((a, b) => b.completedCount - a.completedCount);

  const totalStudents = students.length;
  const avgWeightedScore =
    totalStudents === 0
      ? 0
      : round2(participants.reduce((s, p) => s + p.weightedScore, 0) / totalStudents);

  const snapshot = {
    cohort,
    endedOn,
    generatedAt,
    totals: {
      students: totalStudents,
      challenges: challenges.length,
      completions: completions.length,
      avgWeightedScore,
      totalWeightedScore,
    },
    participants,
    challenges: challengeStats,
  };

  const outPath = resolve(REPO_ROOT, "src", "data", `cohort-${cohort}-archive.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`✅ ${cohort}기 스냅샷 저장: ${outPath}`);
  console.log(
    `   참여자 ${totalStudents}명 · 챌린지 ${challenges.length}개 · 완료누적 ${completions.length}회 · 만점 ${totalWeightedScore}점`,
  );
}

main().catch((err) => {
  console.error("❌ 추출 실패:", err.message);
  process.exit(1);
});
