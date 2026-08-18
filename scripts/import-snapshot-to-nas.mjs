import pg from "pg";
import { assertCanonicalSnapshot, readSnapshotFile, verifySnapshot } from "./lib/migration-snapshot.mjs";

const snapshotFile = process.argv[2];
if (!snapshotFile) throw new Error("usage: import-snapshot-to-nas.mjs <snapshot.json>");
if (process.env.MIGRATION_TARGET_CONFIRM !== "gpters_challenge_board") {
  throw new Error("MIGRATION_TARGET_CONFIRM=gpters_challenge_board is required");
}
if (process.env.MIGRATION_ALLOW_REPLACE !== "nas_cutover") {
  throw new Error("MIGRATION_ALLOW_REPLACE=nas_cutover is required");
}

const snapshot = await readSnapshotFile(snapshotFile);
assertCanonicalSnapshot(snapshot);
const verification = verifySnapshot(snapshot);
if (!verification.ok) throw new Error(`snapshot integrity failed:\n${verification.errors.join("\n")}`);

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 15432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 1,
  application_name: "gpters_migration_import",
  statement_timeout: 30_000,
});

function values(row, columns) {
  return columns.map((column) => row[column] ?? null);
}

function orderChallenges(rows) {
  const pending = new Map(rows.map((row) => [row.id, row]));
  const inserted = new Set();
  const ordered = [];
  while (pending.size) {
    const ready = [...pending.values()].filter(
      (row) => !row.prerequisite_id || inserted.has(row.prerequisite_id),
    );
    if (!ready.length) throw new Error("challenge prerequisite ordering failed");
    ready.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const row of ready) {
      ordered.push(row);
      inserted.add(row.id);
      pending.delete(row.id);
    }
  }
  return ordered;
}

async function insertRows(client, table, columns, rows) {
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const sql = `insert into ${table} (${columns.join(", ")}) values (${placeholders})`;
  for (const row of rows) await client.query(sql, values(row, columns));
}

const client = await pool.connect();
try {
  const identity = await client.query(
    "select current_database() as database, current_user as role, has_database_privilege(current_user, current_database(), 'CREATE') as can_create",
  );
  const current = identity.rows[0];
  if (
    current.database !== "gpters_challenge_board" ||
    current.role !== "gpters_challenge_board_app" ||
    current.can_create !== false
  ) {
    throw new Error(`unsafe migration target identity: ${JSON.stringify(current)}`);
  }

  await client.query("begin");
  await client.query("delete from challenge_examples; delete from completions; delete from challenges; delete from app_users");
  await insertRows(client, "app_users", [
    "id", "nickname", "role", "password_hash", "anonymous_label", "anonymous_index", "created_at", "updated_at",
  ], snapshot.app_users);
  await insertRows(client, "challenges", [
    "id", "title", "description", "detail", "order_index", "level", "area", "tier", "prerequisite_id", "created_at", "updated_at",
  ], orderChallenges(snapshot.challenges));
  await insertRows(client, "challenge_examples", [
    "id", "challenge_id", "cohort", "title", "summary", "source_url", "source_author", "order_index", "created_at",
  ], snapshot.challenge_examples);
  await insertRows(client, "completions", [
    "id", "user_id", "challenge_id", "completed_at",
  ], snapshot.completions);

  const counts = {};
  for (const table of ["app_users", "challenges", "challenge_examples", "completions"]) {
    const { rows } = await client.query(`select count(*)::int as count from ${table}`);
    counts[table] = rows[0].count;
  }
  if (JSON.stringify(counts) !== JSON.stringify(verification.counts)) {
    throw new Error(`row count mismatch before commit: ${JSON.stringify({ counts, expected: verification.counts })}`);
  }
  await client.query("commit");
  console.log(JSON.stringify({ ok: true, target: current.database, counts }, null, 2));
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
