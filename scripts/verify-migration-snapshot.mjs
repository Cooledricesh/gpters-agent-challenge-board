import { readFile } from "node:fs/promises";
import { buildManifest, compareManifests, readSnapshotFile, verifySnapshot } from "./lib/migration-snapshot.mjs";

const [command, ...args] = process.argv.slice(2);
if (command === "verify" && args[0]) {
  const snapshot = await readSnapshotFile(args[0]);
  const result = verifySnapshot(snapshot);
  console.log(JSON.stringify({ ...result, manifest: result.ok ? buildManifest(snapshot) : null }, null, 2));
  if (!result.ok) process.exitCode = 1;
} else if (command === "compare" && args[0] && args[1]) {
  const [source, target] = await Promise.all(
    args.map(async (file) => JSON.parse(await readFile(file, "utf8"))),
  );
  const result = compareManifests(source, target);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} else if (command === "compare-snapshots" && args[0] && args[1]) {
  const [source, target] = await Promise.all(args.map(readSnapshotFile));
  const result = compareManifests(buildManifest(source), buildManifest(target));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} else {
  console.error("Usage: node scripts/verify-migration-snapshot.mjs verify <snapshot.json> | compare <source-manifest.json> <target-manifest.json> | compare-snapshots <source.json> <target.json>");
  process.exitCode = 2;
}
