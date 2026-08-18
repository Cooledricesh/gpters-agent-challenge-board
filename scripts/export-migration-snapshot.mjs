import { createClient } from "@supabase/supabase-js";
import { assertCanonicalSnapshot, writeSnapshotArtifact } from "./lib/migration-snapshot.mjs";

const outputRoot = process.argv[2] ?? "backups/migration-snapshots";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.rpc("migration_snapshot_v1");
if (error) throw new Error(`migration_snapshot_v1 failed: ${error.message}`);
assertCanonicalSnapshot(data);

const { directory, manifest } = await writeSnapshotArtifact(data, outputRoot);
console.log(JSON.stringify({ directory, manifest }, null, 2));
