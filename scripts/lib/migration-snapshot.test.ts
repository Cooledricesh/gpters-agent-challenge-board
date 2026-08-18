import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  assertCanonicalSnapshot,
  buildManifest,
  canonicalTable,
  compareManifests,
  verifySnapshot,
} from "./migration-snapshot.mjs";

function fixture() {
  return {
    schema_version: 1,
    snapshot_at: "2026-08-06T00:00:00.000Z",
    app_users: [
      {
        id: "u1",
        nickname: "student",
        role: "student",
        password_hash: "$2b$12$unchanged",
        anonymous_label: "챌린저 01",
        anonymous_index: 1,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
    ],
    challenges: [
      {
        id: "c1",
        title: "start",
        description: null,
        detail: null,
        level: "basic",
        area: "start",
        order_index: 1,
        tier: 1,
        prerequisite_id: null,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "c2",
        title: "next",
        description: null,
        detail: null,
        level: "advanced",
        area: "build",
        order_index: 2,
        tier: 2,
        prerequisite_id: "c1",
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
    ],
    challenge_examples: [
      {
        id: "e1",
        challenge_id: "c1",
        cohort: "22",
        title: "example",
        summary: null,
        source_url: null,
        source_author: null,
        order_index: 0,
        created_at: "2026-08-01T00:00:00.000Z",
      },
    ],
    completions: [
      {
        id: "x1",
        user_id: "u1",
        challenge_id: "c1",
        completed_at: "2026-08-06T00:00:00.000Z",
      },
    ],
  };
}

describe("migration snapshot", () => {
  it("canonicalizes key and row order deterministically", () => {
    const rows = [{ id: "b", z: 1, a: 2 }, { z: 3, id: "a", a: 4 }];
    expect(canonicalTable(rows)).toBe(
      '{"a":4,"id":"a","z":3}\n{"a":2,"id":"b","z":1}\n',
    );
  });

  it("accepts an intact snapshot and preserves exact hash strings", () => {
    const snapshot = fixture();
    expect(verifySnapshot(snapshot)).toMatchObject({ ok: true });
    const manifest = buildManifest(snapshot);
    const tables = manifest.tables as Record<string, { rows: number; sha256: string }>;
    expect(tables.app_users.rows).toBe(1);
    expect(tables.app_users.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects orphans, duplicate business keys and prerequisite cycles", () => {
    const snapshot = fixture();
    snapshot.challenges[0].prerequisite_id = "c2";
    snapshot.completions.push({ ...snapshot.completions[0], id: "x2" });
    snapshot.completions.push({
      ...snapshot.completions[0],
      id: "x3",
      user_id: "missing",
      challenge_id: "c2",
    });
    const result = verifySnapshot(snapshot);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("prerequisite cycle");
    expect(result.errors.join("\n")).toContain("orphan user");
    expect(result.errors.join("\n")).toContain("duplicate business key");
  });

  it("normalizes Date and UTC timestamp strings to six fractional digits", () => {
    const fromDate = canonicalTable([{ id: "a", created_at: new Date("2026-08-06T00:00:00.000Z") }]);
    const fromSource = canonicalTable([{ id: "a", created_at: "2026-08-06T00:00:00+00:00" }]);
    const fromNasKst = canonicalTable([{ id: "a", created_at: "2026-08-06 09:00:00.000000+09" }]);
    expect(fromDate).toContain('\"created_at\":\"2026-08-06T00:00:00.000000Z\"');
    expect(fromDate).toBe(fromSource);
    expect(fromDate).toBe(fromNasKst);
  });

  it("accepts only the canonical RPC provenance", () => {
    const canonical = {
      ...fixture(),
      source: "supabase_rpc_migration_snapshot_v1",
      consistency: "transaction_consistent_single_statement",
    };
    expect(() => assertCanonicalSnapshot(canonical)).not.toThrow();
    expect(() => assertCanonicalSnapshot({
      ...canonical,
      source: "supabase_postgrest_parallel",
      consistency: "rehearsal_only_non_transactional",
    })).toThrow("canonical snapshot provenance mismatch");
  });

  it("keeps SQL and exporter/importer canonical provenance aligned", () => {
    const sql = readFileSync(
      fileURLToPath(new URL("../../supabase/migrations/20260806_migration_snapshot_v1.sql", import.meta.url)),
      "utf8",
    );
    expect(sql).toContain("'schema_version', 1");
    expect(sql).toContain("'source', 'supabase_rpc_migration_snapshot_v1'");
    expect(sql).toContain("'consistency', 'transaction_consistent_single_statement'");
  });

  it("requires an explicit NAS cutover replacement acknowledgement before reading a snapshot", () => {
    const env: NodeJS.ProcessEnv = { ...process.env, MIGRATION_TARGET_CONFIRM: "gpters_challenge_board" };
    delete env.MIGRATION_ALLOW_REPLACE;
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../import-snapshot-to-nas.mjs", import.meta.url)), "ignored.json"],
      { env, encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("MIGRATION_ALLOW_REPLACE=nas_cutover is required");
  });

  it("compares per-table rows and hashes", () => {
    const source = buildManifest(fixture());
    const target = structuredClone(source);
    expect(compareManifests(source, target)).toEqual({ ok: true, differences: [] });
    (target.tables as Record<string, { rows: number; sha256: string }>).completions.rows += 1;
    expect(compareManifests(source, target).ok).toBe(false);
  });
});
