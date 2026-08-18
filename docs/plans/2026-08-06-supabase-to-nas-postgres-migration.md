# Supabase → NAS PostgreSQL 단순 이전 계획

## 운영 모델

- 서비스는 사실상 정적이다.
- 일반 사용자가 만드는 domain mutation은 challenge completion 확인/해제뿐이다.
- 현재 mutation은 하루 약 2~3건이며 2026-08-11 이후 사용자는 월 2~3명 수준으로 감소할 예정이다.
- 무중단 replication보다 짧은 maintenance window가 더 단순하고 안전하다.

## 최종 구조

- 애플리케이션: Vercel
- 단일 data backend: `DATA_BACKEND=nas`
- NAS API: `https://baclava-nas.tailb06fb8.ts.net/gpters-api`
- NAS PostgreSQL: project `gpters-challenge-board`, DB `gpters_challenge_board`
- 브라우저는 NAS API에 직접 접근하지 않는다. Vercel server만 service token으로 호출한다.
- Supabase는 cutover 직전 snapshot 상태로 일정 기간 보존하되 production read/write에는 사용하지 않는다.

## 유지 기능

- board read, login lookup
- completion toggle
- 현재 UI가 사용하는 student CRUD와 challenge create/update
- transaction-consistent Supabase snapshot
- NAS import와 canonical exact comparison
- encrypted off-NAS backup과 isolated restore
- 제한 runtime DB role, server-only NAS credential, authenticated API
- `MUTATIONS_PAUSED=true|false` maintenance guard
- `DATA_BACKEND=supabase|nas` 단일 backend selector

## 제거 기능

- split read/write selector와 dual write
- transactional outbox, worker, lease, retry, dead-letter
- global sequence/idempotency ledger
- NAS mutation journal과 Supabase reverse replay
- mirror soak와 replication 전용 fixtures/protocol validators
- migration apply/control/status API

## Cutover 순서

1. 현재 사용자 활동과 최근 completion mutation을 확인한다.
2. Vercel에 `MUTATIONS_PAUSED=true`, `DATA_BACKEND=supabase`를 배포하고 completion/admin mutation 503을 확인한다.
3. `migration_snapshot_v1()`으로 final transaction-consistent snapshot을 export한다.
4. NAS DB backup을 생성하고 final snapshot을 import한다.
5. Supabase final snapshot과 NAS export를 canonical exact compare한다. 차이가 있으면 중단한다.
6. Vercel을 `DATA_BACKEND=nas`, `MUTATIONS_PAUSED=true`로 전환한다.
7. board, login, score/progress/ranking 및 admin read를 smoke test한다.
8. 전용 fixture로 completion check/uncheck와 필요한 admin mutation을 검사하고 fixture 0건을 확인한다.
9. `MUTATIONS_PAUSED=false`로 재배포한다.
10. 실제 사용자 completion toggle을 확인하고 NAS backup을 새로 생성한다.

## Rollback

- cutover 직후 NAS mutation이 없으면 Vercel을 `DATA_BACKEND=supabase`로 되돌린다.
- NAS에 신규 completion mutation이 있으면 자동 reverse replay하지 않는다. 해당 소수 항목을 확인해 수동 반영하거나, maintenance 상태에서 NAS snapshot을 기준으로 다시 이전한다.
- rollback 여부와 무관하게 Supabase project 삭제는 별도 승인 후 수행한다.

## Completion gate

- final canonical comparison: `differences: []`
- fixture 잔존: 0
- production env: `DATA_BACKEND=nas`, `MUTATIONS_PAUSED=false`
- production server runtime에 NAS URL/token 존재, browser artifact에는 credential 없음
- production Supabase 호출: 0
- health/auth/board/completion smoke: PASS
- NAS post-cutover backup: PASS
