import pg from "pg";
import { writeSnapshotArtifact } from "./lib/migration-snapshot.mjs";

pg.types.setTypeParser(1184, (value) => value);

const outputRoot = process.argv[2] ?? "backups/nas-snapshots";
const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 15432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 1,
  application_name: "gpters_migration_export",
  statement_timeout: 30_000,
});

const client = await pool.connect();
try {
  await client.query("begin transaction isolation level repeatable read read only");
  const identity = await client.query("select current_database() as database, current_user as role, transaction_timestamp() as snapshot_at");
  const current = identity.rows[0];
  if (current.database !== "gpters_challenge_board" || current.role !== "gpters_challenge_board_app") {
    throw new Error(`unexpected NAS target identity: ${JSON.stringify(current)}`);
  }
  const tables = {};
  for (const table of ["app_users", "challenges", "challenge_examples", "completions"]) {
    const { rows } = await client.query(`select * from ${table} order by id`);
    tables[table] = rows;
  }
  await client.query("commit");
  const snapshot = {
    source: "nas_postgresql_repeatable_read",
    consistency: "transaction_consistent",
    snapshot_at: current.snapshot_at,
    ...tables,
  };
  const artifact = await writeSnapshotArtifact(snapshot, outputRoot);
  console.log(JSON.stringify({ artifact: artifact.directory, manifest: artifact.manifest }, null, 2));
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
