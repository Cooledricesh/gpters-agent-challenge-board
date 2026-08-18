# GPTERS Supabase → NAS cutover state

Updated: 2026-08-18 22:43 KST
Approved execution: 2026-08-08 03:00 KST
Final preflight: 2026-08-08 02:40 KST
Preflight job: `137c5acbdbbe`
Cutover job: `c22c578e44a9` (requires READY output from the preflight job plus the mandatory fresh-preflight validator exit 0)
Morning verification job: `37a56942d152` at 2026-08-08 07:30 KST
Repository: `/Users/seunghyun/Project/gpters-agent-challenge-board`
Runbook: `docs/runbooks/nas-hard-cutover.md`
Production URL: `https://gpters-agent-challenge-board.vercel.app/`

## Owner authorization

Seunghyun explicitly approved preparing all prerequisites and executing the migration at 2026-08-08 03:00 KST. This authorization covers the scoped GPTERS production freeze, final snapshot, NAS replacement import, exact comparison, promotion of the prepared Vercel candidates, reversible smoke fixtures, and verified NAS backup. It does not authorize deleting Supabase.

## Current authority after cutover

- Production backend: NAS read/write
- Canonical production target: `https://gpters-agent-challenge-board.vercel.app` (the immutable deployment ID is intentionally not pinned here because every `main` commit creates a new production deployment)
- Current live counts: 45 users / 49 challenges / 184 examples / 573 completions
- Application backend: NAS only; the selector, Supabase adapter/package/scripts, and Supabase Vercel/local environment variables were removed.
- Supabase project `gpters_challenger_board` was deleted with explicit approval on 2026-08-18. PostgreSQL backup/restore is the only recovery path.

## Verified decommission — 2026-08-18

- Backup `gpters_challenge_board_20260818_140626.dump` passed archive validation.
- Isolated PostgreSQL 17 restore reproduced all four live table counts and UTC-normalized full-row hashes exactly.
- GitHub `main` contains NAS-only commit `33c8937f4e1675652c4313922f4bf23c7acdfccb` before this ingress-documentation update.
- Tests `70/70`, lint, production build, and production dependency audit (`0` vulnerabilities) passed.
- Vercel Production/Preview Supabase variables and legacy backend/write selectors were removed.
- Canonical root and login returned 200 before and after Supabase deletion; NAS API logged `GET /v1/board` 200; container remained healthy with restart count 0.
- Supabase CLI confirmed deletion and the old project endpoint no longer resolved.

## Verified Cloudflare-primary ingress — 2026-08-18

- Vercel Production and Preview `NAS_API_BASE_URL` were changed to `https://gpters-api.rebridge.work`; the service token was not changed.
- NAS cloudflared maps this hostname to `http://127.0.0.1:18887`; config validation passed and the connector established four HA QUIC connections with zero request errors.
- New-origin health returned 200, unauthenticated `/v1/board` returned 401, and an authenticated board request returned 200 with current NAS data.
- Existing SA and Daycare health endpoints remained 200 after the additive config change and cloudflared-only restart.
- Production deployment `dpl_68SGh176Z8VjppoDjiAjaixE5xAV` is Ready on the canonical alias.
- Ten canonical root probes returned 200. In the same window cloudflared total requests increased exactly `19 → 29`, its 200 counter increased `18 → 28`, request errors remained zero, and matching NAS board requests returned 200.
- The previous Funnel path remains configured and verified as the ingress rollback value; it is no longer the Vercel primary origin.

## Verified execution — 2026-08-08

- Mandatory fresh-preflight gate: PASS for job `137c5acbdbbe`; validator SHA-256 `fad1dc262f01624c752f7cf0bbd0070833c5ec0fec875fccdfcb55d9bd713b08`, exit 0, `ok:true`.
- Freeze verified: `2026-08-08 03:02:40 KST` on Supabase frozen deployment `dpl_551j624yamvxpr1XDmXQqUJUizgQ`.
- Freeze ended: `2026-08-08 03:05:11 KST` on successful NAS open promotion; duration `151s` (`2m 31s`).
- Final source snapshot: `backups/cutover-20260808/source-confirm/2026-08-07T18-02-54-073599+00-00/snapshot.json`.
- Final source and NAS counts: 48 users / 49 challenges / 184 examples / 507 completions.
- Canonical table SHA-256: users `a810d1a2cd9788f63c603191e27c71f6f7896d4f8e0edc887965011c288b7876`; challenges `8b13558516eb93c691d3506e433a19cc11d71d5ba02ef1abd8af163b158997fe`; examples `c56cb3b330257734dc55f2d5b13dbf47ed108d94e397f542aa19f51e499a3e89`; completions `a4ce1724890709b7c47260a02872b3e3714765a432e24952bbe59311d9203cf4`.
- Source→NAS exact comparison: `{"ok":true,"differences":[]}`.
- Supabase frozen source→post-open Supabase export: `{"ok":true,"differences":[]}`; no production write returned to Supabase.
- NAS runtime identity: `gpters_challenge_board / gpters_challenge_board_app / CREATE=false`.
- Pre-replacement backup: `20260808_030254`; post-cutover backup: `20260808_030815`; both read back through healthy `dbctl status`.
- NAS frozen validation: canonical root/admin login 200, 47 students / 49 challenges / 507 completions rendered, valid admin mutation 503, fixture residue 0, and NAS API `/v1/board` plus `/v1/auth/lookup` request logs returned 200.
- NAS open reversible production smoke: admin login; dedicated student create/login; completion true; fresh login and `/my` persistence; password update and relogin; completion false; student delete — all 200. Intermediate state 49 users / 508 completions; final state restored to 48 / 49 / 184 / 507 with zero `__cutover_e2e_%` users/completions.
- Rollback state: not invoked. Supabase open/frozen immutable candidates remain available, and Supabase is preserved unchanged as the inactive rollback anchor.

## Immutable Vercel candidates

All candidates target Production but were created with `--skip-domain`; the canonical production alias remained on `dpl_BwVMkEQDFYqa17NjyJhjDxrSAMhy` after preparation.

| Purpose | Deployment ID | Validation |
|---|---|---|
| Supabase open rollback | `dpl_3wcfQaZagpVSjFqxdkKdkHLpsRw9` | READY; root 200; admin login 200 |
| Supabase frozen | `dpl_551j624yamvxpr1XDmXQqUJUizgQ` | READY; root 200; admin login 200; admin mutation 503 |
| NAS frozen | `dpl_6nn2tFjYR3vjVHVGPEHW1VWFnE8f` | READY; root 200; admin login 200; admin mutation 503 |
| NAS open | `dpl_G2dCsgyBbftFMf2o5VkKsQtGVvgn` | READY; root 200; admin login 200; mutation intentionally deferred until final import |

Production environment has the four required names registered: `DATA_BACKEND`, `MUTATIONS_PAUSED`, `NAS_API_BASE_URL`, and sensitive `NAS_API_SERVICE_TOKEN`. The current deployment predates those registrations and was not changed by preparation.

## Pinned critical artifacts

Verify these hashes during the 02:40 preflight and again before the 03:00 freeze. Any mismatch is a blocker unless independently reviewed before execution.

```text
fad1dc262f01624c752f7cf0bbd0070833c5ec0fec875fccdfcb55d9bd713b08  scripts/assert-fresh-cutover-preflight.mjs
1d2398eac1c4c33123f68f33afeaaa40ca6e441271c8eca4a7a585b18f7940a9  scripts/export-migration-snapshot.mjs
c6946b741edf77914674268e64241ca474d1795065025a228f18c1d741276493  scripts/import-snapshot-to-nas.mjs
af4226dde4f4ba72f007997fb7380c476f391eff58da4401768726e0bf7f2457  scripts/export-nas-snapshot.mjs
970cb11a6861fde561122ff7f054475243038fef95259e68632d14759bf8e0f3  scripts/verify-migration-snapshot.mjs
9b069c7781f5cc5e54ad3ef221d120843691f3bdde9eed2c05c07c6bc2ff01d8  scripts/lib/migration-snapshot.mjs
782bc0abff5adbc113a4f5b35d6d228c7da9315a54fde8a2f2aee897a40964d3  docs/runbooks/nas-hard-cutover.md
```

## Completion contract

Cutover is accepted only when all conditions pass:

1. Supabase frozen candidate is promoted and canonical domain mutations return 503.
2. A final transaction-consistent Supabase snapshot is exported after freeze.
3. A fresh verified NAS backup is created before replacement.
4. Final snapshot import succeeds under `gpters_challenge_board_app` with `CREATE=false`.
5. NAS export versus frozen source returns exit 0 and `differences: []`.
6. NAS frozen candidate is promoted; root, login, board, score/progress/ranking, and mutation 503 checks pass.
7. NAS open candidate is promoted; dedicated reversible student/completion fixture smoke passes and leaves zero residue.
8. A post-cutover NAS backup is verified.
9. Canonical production deployment and stored production `DATA_BACKEND=nas`, `MUTATIONS_PAUSED=false` state are verified.
10. Supabase remains preserved and inactive as rollback anchor.
11. Project execution state and `agent-ops` service inventory/runbook are updated with real evidence and measured freeze duration.

## Stop and rollback rules

- If preflight is BLOCKED, do not promote, freeze, import, or change production traffic.
- Before any NAS production mutation, failure means promote Supabase frozen, verify, then Supabase open.
- After NAS writes are opened, a failure means immediately promote NAS frozen and keep maintenance active. Reconcile the tiny post-cutover change set before any Supabase rollback; do not silently discard writes or create reverse replication.
- Freeze target is about 10 minutes. At 15 minutes explicitly assess progress; at 20 minutes without an accepted cutover, rollback unless rollback itself would risk committed NAS writes.
- Never delete Supabase during this operation.
