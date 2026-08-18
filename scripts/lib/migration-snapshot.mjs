import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const TABLES = [
  "app_users",
  "challenges",
  "challenge_examples",
  "completions",
];

export const CANONICAL_PROVENANCE = Object.freeze({
  schema_version: 1,
  source: "supabase_rpc_migration_snapshot_v1",
  consistency: "transaction_consistent_single_statement",
});

export function assertCanonicalSnapshot(snapshot) {
  for (const [key, expected] of Object.entries(CANONICAL_PROVENANCE)) {
    if (snapshot?.[key] !== expected) {
      throw new Error(`canonical snapshot provenance mismatch: ${key}`);
    }
  }
}

const LEVELS = new Set(["basic", "advanced"]);
const TIERS = new Set([1, 2, 3]);
const AREAS = new Set([
  "start",
  "channel",
  "automation",
  "content",
  "operations",
  "integrations",
  "orchestration",
  "build",
  "voice-ui",
  "edge",
  "other",
]);

function normalizeTimestamp(value) {
  if (value instanceof Date) return value.toISOString().replace(/\.([0-9]{3})Z$/, ".$1000Z");
  if (typeof value !== "string") return value;
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.([0-9]+))?(Z|[+-]\d{2}(?::?\d{2})?)$/,
  );
  if (!match) return value;
  const fraction = (match[3] ?? "").padEnd(6, "0").slice(0, 6);
  let offset = match[4];
  if (/^[+-]\d{2}$/.test(offset)) offset = `${offset}:00`;
  if (/^[+-]\d{4}$/.test(offset)) offset = `${offset.slice(0, 3)}:${offset.slice(3)}`;
  const parsed = new Date(`${match[1]}T${match[2]}.${fraction.slice(0, 3)}${offset}`);
  if (Number.isNaN(parsed.valueOf())) return value;
  return `${parsed.toISOString().slice(0, 19)}.${fraction}Z`;
}

function sortObject(value) {
  value = normalizeTimestamp(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortObject(value[key])]),
    );
  }
  return value;
}

export function canonicalRow(row) {
  return JSON.stringify(sortObject(row));
}

export function canonicalTable(rows) {
  return [...rows]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map(canonicalRow)
    .join("\n") + (rows.length ? "\n" : "");
}

export function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function requireArray(snapshot, table) {
  const value = snapshot?.[table];
  if (!Array.isArray(value)) throw new Error(`${table} must be an array`);
  return value;
}

function duplicateValues(rows, field, { ignoreNull = false } = {}) {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows) {
    const value = row[field];
    if (ignoreNull && (value === null || value === undefined)) continue;
    const key = JSON.stringify(value);
    if (seen.has(key)) duplicates.add(String(value));
    seen.add(key);
  }
  return [...duplicates].sort();
}

export function verifySnapshot(snapshot) {
  const errors = [];
  const tables = Object.fromEntries(TABLES.map((name) => [name, requireArray(snapshot, name)]));

  for (const [name, rows] of Object.entries(tables)) {
    const duplicateIds = duplicateValues(rows, "id");
    if (duplicateIds.length) errors.push(`${name}: duplicate ids: ${duplicateIds.join(", ")}`);
    for (const row of rows) {
      if (!row.id) errors.push(`${name}: row without id`);
    }
  }

  const users = new Map(tables.app_users.map((row) => [row.id, row]));
  const challenges = new Map(tables.challenges.map((row) => [row.id, row]));

  for (const field of ["nickname", "anonymous_label", "anonymous_index"]) {
    const duplicates = duplicateValues(tables.app_users, field, { ignoreNull: true });
    if (duplicates.length) errors.push(`app_users: duplicate ${field}: ${duplicates.join(", ")}`);
  }

  for (const challenge of tables.challenges) {
    if (!LEVELS.has(challenge.level)) errors.push(`challenges:${challenge.id}: invalid level`);
    if (!TIERS.has(challenge.tier)) errors.push(`challenges:${challenge.id}: invalid tier`);
    if (challenge.area !== null && challenge.area !== undefined && !AREAS.has(challenge.area)) {
      errors.push(`challenges:${challenge.id}: invalid area`);
    }
    if (challenge.prerequisite_id && !challenges.has(challenge.prerequisite_id)) {
      errors.push(`challenges:${challenge.id}: orphan prerequisite ${challenge.prerequisite_id}`);
    }
  }

  for (const challenge of tables.challenges) {
    const seen = new Set([challenge.id]);
    let current = challenge;
    while (current?.prerequisite_id) {
      if (seen.has(current.prerequisite_id)) {
        errors.push(`challenges:${challenge.id}: prerequisite cycle`);
        break;
      }
      seen.add(current.prerequisite_id);
      current = challenges.get(current.prerequisite_id);
    }
  }

  const completionKeys = new Set();
  for (const completion of tables.completions) {
    if (!users.has(completion.user_id)) errors.push(`completions:${completion.id}: orphan user`);
    if (!challenges.has(completion.challenge_id)) errors.push(`completions:${completion.id}: orphan challenge`);
    const key = `${completion.user_id}:${completion.challenge_id}`;
    if (completionKeys.has(key)) errors.push(`completions:${completion.id}: duplicate business key`);
    completionKeys.add(key);
  }

  for (const example of tables.challenge_examples) {
    if (!challenges.has(example.challenge_id)) {
      errors.push(`challenge_examples:${example.id}: orphan challenge`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: Object.fromEntries(TABLES.map((name) => [name, tables[name].length])),
  };
}

export function buildManifest(snapshot) {
  const verification = verifySnapshot(snapshot);
  if (!verification.ok) throw new Error(`snapshot integrity failed:\n${verification.errors.join("\n")}`);
  const tables = {};
  for (const name of TABLES) {
    const body = canonicalTable(snapshot[name]);
    tables[name] = { rows: snapshot[name].length, sha256: sha256(body) };
  }
  return {
    format_version: 1,
    generated_at: new Date().toISOString(),
    source_snapshot_at: snapshot.snapshot_at ?? null,
    source: snapshot.source ?? "unknown",
    consistency: snapshot.consistency ?? "unknown",
    tables,
  };
}

export async function writeSnapshotArtifact(snapshot, outputRoot) {
  const manifest = buildManifest(snapshot);
  const safeTimestamp = String(snapshot.snapshot_at ?? new Date().toISOString()).replace(/[:.]/g, "-");
  const directory = path.join(outputRoot, safeTimestamp);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);

  for (const name of TABLES) {
    const file = path.join(directory, `${name}.jsonl`);
    await writeFile(file, canonicalTable(snapshot[name]), { mode: 0o600 });
    await chmod(file, 0o600);
  }

  const snapshotFile = path.join(directory, "snapshot.json");
  await writeFile(snapshotFile, `${canonicalRow(snapshot)}\n`, { mode: 0o600 });
  await chmod(snapshotFile, 0o600);

  const manifestFile = path.join(directory, "manifest.json");
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await chmod(manifestFile, 0o600);
  return { directory, manifest };
}

export async function readSnapshotFile(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export function compareManifests(source, target) {
  const differences = [];
  for (const name of TABLES) {
    const left = source.tables?.[name];
    const right = target.tables?.[name];
    if (!left || !right) {
      differences.push(`${name}: missing manifest entry`);
      continue;
    }
    if (left.rows !== right.rows) differences.push(`${name}: rows ${left.rows} != ${right.rows}`);
    if (left.sha256 !== right.sha256) differences.push(`${name}: sha256 mismatch`);
  }
  return { ok: differences.length === 0, differences };
}
