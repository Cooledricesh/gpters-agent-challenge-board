# Supabase → NAS 이전 현재 상태

> **Historical cutover execution record.** Values below describe the 2026-08-08 migration window and are not current deployment, database-fallback, or ingress instructions. Current production is NAS-only with Cloudflare primary at `https://gpters-api.rebridge.work`; the Funnel path is retained only for ingress rollback. Use `docs/plans/2026-08-08-cutover-state.md` for current state.

Updated: 2026-08-08 03:08 KST

## 현재 production

- URL: `https://gpters-agent-challenge-board.vercel.app/`
- authoritative backend: NAS read/write
- NAS cutover: 2026-08-08 03:05:11 KST 완료
- canonical deployment: `dpl_G2dCsgyBbftFMf2o5VkKsQtGVvgn`
- canonical counts: app users 48, challenges 49, examples 184, completions 507
- exact source→NAS comparison: `{"ok":true,"differences":[]}`
- production freeze: 2026-08-08 03:02:40–03:05:11 KST, 151초
- verified backups: pre-replacement `20260808_030254`, post-cutover `20260808_030815`
- production reversible smoke: PASS; fixture users/completions 0, baseline restored
- Supabase: 변경 없이 inactive rollback anchor로 보존
- Supabase의 obsolete outbox/control/replay functions, triggers, tables: 제거 완료
- `migration_snapshot_v1()`: 유지

## 준비 완료

- Supabase `migration_snapshot_v1()` transaction-consistent export
- NAS snapshot import와 canonical exact comparison
- NAS project DB/API와 protected Tailscale Funnel path
- encrypted off-NAS backup 및 PostgreSQL 17 isolated restore
- NAS runtime role의 다른 project DB 접근 거부
- application backend adapter: Supabase 또는 NAS 한 곳만 선택
- application maintenance guard: `MUTATIONS_PAUSED`
- NAS obsolete objects cleanup 및 simple API image 배포
- NAS completion toggle와 retained admin CRUD smoke, fixture 0
- Supabase standard completion mutation/restore smoke
- cutover runbook positional snapshot/export, explicit `compare-snapshots`, discrete `DB_*` credential contract, freeze/read-only smoke/write-open 순서 rehearsal 완료
- ignored `backups/phase4-*` mirror/replay evidence directories 제거 완료

## 이번 단순화에서 제거

- mirror repository와 split write mode
- Supabase outbox/replay migrations 및 worker
- NAS ledger/journal/control API와 direct-write guard
- retry/dead-letter/lease/sequence protocol
- mirror E2E/soak/replay fixtures와 전용 tests/docs

## 아직 남은 실행 단계

1. 안정화 기간 동안 NAS health/backup과 production 오류율 관찰
2. 별도 승인 후에만 Supabase 삭제 검토

## 금지 사항

- `supabase db push` 사용 금지: linked migration history mismatch가 존재한다.
- production cutover 전 dual write/mirror/worker 활성화 금지.
- Supabase project 즉시 삭제 금지.
- 사용자 승인 없는 commit 금지.
