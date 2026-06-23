/**
 * reset-for-next-cohort.mjs — 종료된 기수 데이터를 비워 다음 기수에 보드를 재사용한다.
 *
 * 파괴적 작업이다. 반드시 먼저 아카이브 스냅샷(scripts/export-cohort-archive.mjs)을 만들어 둘 것.
 *
 * 사용법:
 *   node scripts/reset-for-next-cohort.mjs            # dry-run: 삭제 대상 건수만 출력
 *   node scripts/reset-for-next-cohort.mjs --confirm  # 백업 후 실제 삭제
 *
 * 동작(--confirm):
 *   1. 닉네임 포함 원본 전체를 backups/cohort-reset-<timestamp>.json 에 저장(안전망, gitignore).
 *   2. completions 전체 삭제.
 *   3. app_users 중 role='student' 삭제. (FK on delete cascade이지만 명시적으로 처리)
 * 유지: challenges(과제 목록), role='admin' 계정.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { REPO_ROOT, makeServiceClient, unwrap } from "./lib/cohort-data.mjs";

const confirm = process.argv.slice(2).includes("--confirm");

async function main() {
  const client = makeServiceClient();

  // 현재 상태 파악(백업 + 건수).
  const [appUsers, challenges, completions] = await Promise.all([
    client.from("app_users").select("*").then((r) => unwrap(r, "app_users")),
    client.from("challenges").select("*").then((r) => unwrap(r, "challenges")),
    client.from("completions").select("*").then((r) => unwrap(r, "completions")),
  ]);

  const students = appUsers.filter((u) => u.role === "student");
  const admins = appUsers.filter((u) => u.role === "admin");

  console.log("현재 DB 상태:");
  console.log(`  - 수강생(student): ${students.length}명  (삭제 예정)`);
  console.log(`  - 관리자(admin):   ${admins.length}명  (유지)`);
  console.log(`  - 챌린지:          ${challenges.length}개  (유지)`);
  console.log(`  - 완료 기록:       ${completions.length}건  (삭제 예정)`);

  if (!confirm) {
    console.log("\n⚠️  dry-run입니다. 실제로 삭제하려면 --confirm 플래그를 붙이세요.");
    console.log("    먼저 scripts/export-cohort-archive.mjs로 아카이브를 만들었는지 확인하세요.");
    return;
  }

  // 1. 백업.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = resolve(REPO_ROOT, "backups");
  mkdirSync(backupDir, { recursive: true });
  const backupPath = resolve(backupDir, `cohort-reset-${stamp}.json`);
  writeFileSync(
    backupPath,
    `${JSON.stringify({ takenAt: new Date().toISOString(), appUsers, challenges, completions }, null, 2)}\n`,
    "utf8",
  );
  console.log(`\n💾 원본 백업 저장: ${backupPath}`);

  // 2. completions 전체 삭제. (delete 전체 행: 항상 참인 조건 필요)
  const delCompletions = await client.from("completions").delete().not("id", "is", null);
  if (delCompletions.error) throw new Error(`completions 삭제 실패: ${delCompletions.error.message}`);
  console.log("🗑️  completions 전체 삭제 완료");

  // 3. 수강생 계정 삭제.
  const delStudents = await client.from("app_users").delete().eq("role", "student");
  if (delStudents.error) throw new Error(`app_users(student) 삭제 실패: ${delStudents.error.message}`);
  console.log("🗑️  수강생 계정 삭제 완료");

  // 검증.
  const [afterUsers, afterCompletions, afterChallenges] = await Promise.all([
    client.from("app_users").select("id, role").then((r) => unwrap(r, "app_users")),
    client.from("completions").select("id").then((r) => unwrap(r, "completions")),
    client.from("challenges").select("id").then((r) => unwrap(r, "challenges")),
  ]);
  console.log("\n리셋 후 상태:");
  console.log(`  - 수강생: ${afterUsers.filter((u) => u.role === "student").length}명`);
  console.log(`  - 관리자: ${afterUsers.filter((u) => u.role === "admin").length}명`);
  console.log(`  - 챌린지: ${afterChallenges.length}개`);
  console.log(`  - 완료 기록: ${afterCompletions.length}건`);
  console.log("\n✅ 23기 보드 준비 완료. 관리자 화면에서 수강생을 새로 등록하세요.");
}

main().catch((err) => {
  console.error("❌ 리셋 실패:", err.message);
  process.exit(1);
});
