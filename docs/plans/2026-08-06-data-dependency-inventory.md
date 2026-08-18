# Data dependency inventory

## Runtime selection

| Variable | Default | Cutover value | Purpose |
|---|---|---|---|
| `DATA_BACKEND` | `supabase` | `nas` | Reads and writes use the same backend |
| `MUTATIONS_PAUSED` | `false` | `true` only during maintenance | Reject completion/admin mutations with 503 |
| `NAS_API_BASE_URL` | required only for NAS | Funnel `/gpters-api` URL | Server-to-server API endpoint |
| `NAS_API_SERVICE_TOKEN` | required only for NAS | secret | Server-only API authentication |

Supabase credentials remain required only while `DATA_BACKEND=supabase`. NAS mode must not require Supabase credentials at request time.

## Domain tables

- `app_users`: login, student/admin identity, password hash, anonymous ranking label
- `challenges`: board curriculum
- `challenge_examples`: board examples
- `completions`: the normal user mutation; `(user_id, challenge_id)` is unique

## Runtime paths

- public/admin board reads → `getDataRepository()`
- login lookup → `getDataRepository()`
- completion toggle → maintenance guard → `getDataRepository()`
- current admin mutations → maintenance guard → `getDataRepository()`

There is no split read/write mode, mirror repository, replication worker, journal or replay path.

## One-shot migration tools

- `scripts/export-migration-snapshot.mjs`: service-role-only transaction-consistent Supabase snapshot
- `scripts/import-snapshot-to-nas.mjs`: acknowledged destructive replace of the four domain tables
- `scripts/export-nas-snapshot.mjs`: canonical NAS snapshot
- `scripts/verify-migration-snapshot.mjs`: exact canonical comparison
- `scripts/lib/migration-snapshot.mjs`: snapshot normalization/hash/comparison rules

## Security boundaries

- Browser code never receives NAS URL/token or PostgreSQL credentials.
- NAS PostgreSQL remains loopback-bound.
- Public Funnel exposes only `/gpters-api`; browser Origin is rejected.
- API uses a project runtime role, not project owner credentials.
- Backups are encrypted before being retained off NAS.
