import { createClient } from "@supabase/supabase-js";
import { writeSnapshotArtifact } from "./lib/migration-snapshot.mjs";

const outputRoot = process.argv[2] ?? "backups/rehearsal-snapshots";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const startedAt = new Date().toISOString();
const tableNames = ["app_users", "challenges", "challenge_examples", "completions"];
const results = await Promise.all(
  tableNames.map(async (table) => {
    const { data, error } = await client.from(table).select("*").order("id", { ascending: true });
    if (error) throw new Error(`${table} rehearsal export failed: ${error.message}`);
    return data ?? [];
  }),
);
const snapshot = {
  schema_version: 1,
  source: "supabase_postgrest_parallel",
  consistency: "rehearsal_only_non_transactional",
  snapshot_at: startedAt,
  export_completed_at: new Date().toISOString(),
  ...Object.fromEntries(tableNames.map((name, index) => [name, results[index]])),
};
const artifact = await writeSnapshotArtifact(snapshot, outputRoot);
console.warn("WARNING: rehearsal-only snapshot; never use this artifact for cutover.");
console.log(JSON.stringify({ artifact: artifact.directory, manifest: artifact.manifest }, null, 2));
