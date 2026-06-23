# 22기 챌린지 보드 아카이빙 + 23기 초기화 설계

- 날짜: 2026-06-23
- 접근: A (커밋된 JSON 스냅샷 + 정적 아카이브 페이지)

## 배경 / 목표

지피터스 22기 스터디가 종료되었다. 현재까지 달성된 내용을 **더 이상 변하지 않도록 동결**하여
앱 안에서 열람 가능한 아카이브로 보존하고, 같은 보드를 **23기에 재사용**할 수 있도록 초기화한다.

확정된 결정사항:

- 최종 상태: 동결 + 23기 재사용 준비 (한 번에 진행)
- 22기 열람 방식: 앱 내 아카이브 페이지
- 23기 초기화 범위: 수강생·완료기록만 비우고 **챌린지(과제) 목록과 admin 계정은 유지**

## 설계 원칙

- 아카이브는 DB를 조회하지 않는 **정적 스냅샷**으로 만든다. 23기 리셋(데이터 삭제)과 완전히
  분리되며, 코드/운영 규율이 아니라 구조적으로 불변이 보장된다.
- 공개 페이지(`/`)와 동일한 **익명 원칙**을 따른다. 스냅샷에는 닉네임·비밀번호 등 개인정보를
  넣지 않고 익명 라벨("챌린저 01")만 담는다.
- 신규 npm 의존성을 추가하지 않는다. 이미 있는 `@supabase/supabase-js`만 사용한다.
- 가중치·정렬 규칙은 기존 `src/lib/progress.ts`와 동일하게 유지한다(기본 1점, 고급 1.25점,
  공개 정렬 = 가중점수 내림차순 · 라벨 오름차순 tiebreak).

## 구성 요소

### 1. 스냅샷 추출 스크립트 — `scripts/export-cohort-archive.mjs`

- `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`로 접속.
- `app_users(role='student')`, `challenges`, `completions`를 조회해 홈 화면과 동일한 익명
  집계를 계산하고 `src/data/cohort-22-archive.json`에 기록한다.
- 출력 JSON 형태:

  ```json
  {
    "cohort": "22",
    "endedOn": "2026-06-23",
    "generatedAt": "<ISO timestamp>",
    "totals": {
      "students": 0,
      "challenges": 0,
      "completions": 0,
      "avgWeightedScore": 0,
      "totalWeightedScore": 0
    },
    "participants": [
      { "anonymousLabel": "챌린저 01", "weightedScore": 0, "progressPercent": 0 }
    ],
    "challenges": [
      { "title": "...", "level": "basic", "completedCount": 0 }
    ]
  }
  ```

  - `participants`: 가중점수 내림차순(tiebreak 라벨 오름차순).
  - `challenges`: 완료수 내림차순.

### 2. 아카이브 페이지 — `/archive/22`

- `src/app/archive/22/page.tsx` (또는 `src/app/archive/[cohort]/page.tsx`로 일반화하되
  22 스냅샷만 매핑). 위 JSON만 import 해 렌더하는 **읽기 전용 서버 컴포넌트**. DB 조회 없음.
- 홈의 통계 카드 / 참여자 순위 / 챌린지별 완료 현황 레이아웃을 재사용하되 로그인 CTA·체크
  버튼·"본인" 강조는 제거한다. 상단에 "지피터스 22기 · 종료 (아카이브)" 배지를 둔다.
- 공통 표시 컴포넌트(StatsCard, ProgressBar 등)는 홈과 중복되므로 작은 공용 모듈로 추출해
  홈과 아카이브가 공유한다.

### 3. 현재 기수 라벨 정리 — `src/lib/cohort.ts`

- `CURRENT_COHORT = "23기"` 상수를 한 곳에 둔다.
- `layout.tsx`의 `<title>`/메타데이터/푸터 등에 하드코딩된 "22기"를 이 상수로 치환.
  다음 기수부터는 이 한 줄만 바꾼다. 아카이브 페이지는 자체적으로 "22기"를 표기한다.
- 홈(`/`)과 헤더 네비게이션에 "22기 아카이브 보기" 링크(`/archive/22`)를 추가한다.

### 4. 23기 초기화 스크립트 — `scripts/reset-for-next-cohort.mjs`

- 파괴적 작업. `--confirm` 플래그가 없으면 삭제 대상 건수만 출력하는 dry-run.
- 실행 순서:
  1. 닉네임 포함 **원본 전체 백업**을 `backups/cohort-22-full-<timestamp>.json`에 저장
     (app_users 전체 + challenges + completions 원본 행).
  2. `completions` 전체 삭제.
  3. `app_users`에서 `role = 'student'` 삭제. (completions는 FK `on delete cascade`이지만
     명시적으로 먼저 비워 두 단계가 모두 검증되게 한다.)
- **유지**: `challenges`, `role='admin'` 계정.
- `.gitignore`에 `/backups` 추가.

## 데이터 흐름

```
[현재 Supabase DB]
   │  export-cohort-archive.mjs (읽기)
   ▼
src/data/cohort-22-archive.json  ──→  /archive/22 (정적 렌더, DB 무관)
   │
   │  reset-for-next-cohort.mjs (백업 후 삭제)
   ▼
backups/cohort-22-full-<ts>.json (안전망, gitignore)
[비워진 DB: challenges/admin만 유지]  ──→  / (23기 라이브)
```

## 실행 순서 & 검증

1. `node scripts/export-cohort-archive.mjs` → `src/data/cohort-22-archive.json` 생성·내용 확인.
2. 아카이브 페이지 / 링크 / `cohort.ts` 구현. `npm run build` + `npm test` 통과.
3. `node scripts/reset-for-next-cohort.mjs`(dry-run) → 건수 확인 → `--confirm`으로 실제 실행,
   `backups/` 백업 파일 생성 확인.
4. 라이브 보드(`/`)가 빈 23기 상태(참여자 0, 챌린지 유지)이고 `/archive/22`가 22기 최종
   현황을 그대로 보여주는지 확인.

## 테스트

- 스냅샷 JSON → 화면 데이터(정렬·총계) 변환 로직에 대한 단위 테스트를 기존 `src/**/*.test.ts`
  패턴으로 추가.
- `cohort.ts` 라벨 및 아카이브 페이지에 노출되는 카피에 대한 가벼운 테스트(`copy.test.ts`,
  `layout.test.ts` 패턴 참고).

## 범위 밖 (YAGNI)

- 다기수(cohort) 컬럼 도입, 라이브 쿼리의 기수 필터링.
- 백업 파일의 외부 스토리지 업로드.
- 23기 수강생/과제의 신규 등록 자동화(기존 관리자 화면 그대로 사용).
</content>
</invoke>
