# NAS hard cutover runbook

This is a short maintenance-window migration for a very low-traffic service. It does not use dual writes, mirror workers, journals, replay, or split read/write modes.

## Preconditions

- explicit cutover approval and maintenance start time
- no active user session performing a completion toggle
- Supabase and NAS credentials available only in approved secret stores
- NAS API `/health` is 200 and protected endpoints return 401 without a token
- fresh NAS backup succeeds
- current application revision has passed tests and build

This runbook does not authorize cutover by itself. Stop unless all preconditions are confirmed.

## 1. Freeze every domain mutation

Deploy the application with:

```text
DATA_BACKEND=supabase
MUTATIONS_PAUSED=true
```

Verify:

- board and login still work
- completion and all admin mutation APIs return 503
- no source mutation occurred after the freeze timestamp

Keep mutations paused through snapshot, import, exact comparison, backend switch, and read-only smoke.

## 2. Export the final Supabase snapshot

The exporter takes one positional argument: the output root directory.

```bash
npm run migration:snapshot -- /absolute/path/to/final-source-snapshots
```

Record the generated `snapshot.json` path from the command output as `<final-source-snapshot.json>`.

The snapshot must report:

- `schema_version=1`
- `source=supabase_rpc_migration_snapshot_v1`
- `consistency=transaction_consistent_single_statement`

## 3. Back up and replace NAS data

Create and verify a `dbctl backup` first.

Load the approved NAS runtime credential file without printing it. The scripts use the discrete `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` variables; they do not read `DATABASE_URL`.

When running from the Tailnet Mac, override only `DB_HOST` after loading the credential file:

```bash
set -a
. /absolute/path/to/approved-nas-runtime.env
set +a
export DB_HOST=baclava-nas.tailb06fb8.ts.net

MIGRATION_TARGET_CONFIRM=gpters_challenge_board \
MIGRATION_ALLOW_REPLACE=nas_cutover \
npm run migration:import-nas -- <final-source-snapshot.json>
```

The importer must confirm the target database, runtime role, denied `CREATE` privilege, and expected row counts before commit.

## 4. Export NAS and require exact equality

The NAS exporter also takes one positional output-root argument and uses the same `DB_*` environment variables.

```bash
npm run migration:export-nas -- /absolute/path/to/final-nas-snapshots
```

Record its generated `snapshot.json` path as `<final-nas-snapshot.json>`, then run:

```bash
npm run migration:verify -- compare-snapshots \
  <final-source-snapshot.json> \
  <final-nas-snapshot.json>
```

Proceed only when the command exits 0 with:

```json
{"ok":true,"differences":[]}
```

Then remove the temporary runtime credential file, if one was created, and clear credential variables from the shell.

## 5. Switch traffic while writes remain frozen

Deploy:

```text
DATA_BACKEND=nas
MUTATIONS_PAUSED=true
NAS_API_BASE_URL=<server-only URL>
NAS_API_SERVICE_TOKEN=<server-only secret>
```

Supabase credentials may remain stored temporarily for rollback, but production requests must select only NAS.

## 6. Read-only production smoke

While `MUTATIONS_PAUSED=true`, verify:

- root and board load
- student login/logout
- admin login/logout
- score, progress, and ranking match the final snapshot
- completion and admin mutation APIs still return 503
- logs show NAS API calls and no Supabase data calls

If any check fails, switch `DATA_BACKEND=supabase` while writes remain paused.

## 7. Open NAS writes and run mutation smoke

Deploy:

```text
DATA_BACKEND=nas
MUTATIONS_PAUSED=false
```

Immediately use dedicated `__...e2e...` fixtures to verify:

- completion check, refresh persistence, and uncheck
- student create/update/delete
- challenge create/update and explicit fixture cleanup
- score, progress, and ranking after cleanup
- zero fixture rows remain
- the smoke mutation exists only in NAS, not Supabase

Record board, login, and completion latency. Do not add a long soak gate for this low-traffic service.

Create and verify a new NAS backup after successful cleanup.

## Rollback

- Before any NAS mutation: deploy `DATA_BACKEND=supabase` with `MUTATIONS_PAUSED=true`; verify reads/login, then set `MUTATIONS_PAUSED=false`.
- After NAS mutations: keep mutations paused, list the small set of changes since cutover, and choose manual copy or a fresh one-time migration. Do not run permanent reverse replay.

## Stabilization and Supabase removal

Keep Supabase unchanged as a rollback anchor for the agreed stabilization period. Delete the Supabase project only after separate approval and evidence of healthy NAS operation and verified backups.
