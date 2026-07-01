# 도전과제에 22기 선배 사례글 붙이기 — 설계

- 날짜: 2026-07-01
- 접근: A (별도 `challenge_examples` 테이블 + 공유 상세 뷰에 "선배 사례" 섹션)

## 배경 / 목표

지피터스 22기 참여자들이 gpters.org에 발표한 사례글 99개가 옵시디언 볼트
(`~/obsidian/바클라바/30. Permanent Notes/지피터스 스터디/지피터스 22기 반려 에이전트 사례글/`)에
수집되어 있다. 각 노트는 frontmatter에 제목·요약·원문 링크(`source_url`)·원작자(`source_author`)·
도구·태그를 담는다(99개 중 98개가 source_url 보유, 전부 status: completed).

이 사례글을 챌린지 상세에 연결해, 참여자가 도전과제를 볼 때 "선배들이 실제로 어떻게 활용했는지"를
원문 링크로 읽을 수 있게 한다. 챌린지 43개(기본 18 + 고급 25)는 23기 재사용을 위해 리셋 때
보존했으므로 challenge_id가 안정적이다.

확정된 결정사항:

- 매핑 방식: **LLM 자동매핑 + 사용자 검토**. 에이전트가 사례글별로 가장 잘 맞는 챌린지(1~2개)를
  신뢰도와 함께 제안 → 매핑 JSON 생성 → 사용자 검토·수정 후 임포트.
- 노출 위치: **공개 홈(/) + /my 상세**. 두 라이브 표면 모두 챌린지 상세에서 사례를 노출.
- 데이터 모델: **별도 테이블 A**.

## 설계 원칙

- 사례글은 챌린지에 종속된 참고자료다. 라이브 `challenges` 테이블에 연결하고 기수 간 재사용한다.
- gpters.org 공개 글이므로 `source_author`·`source_url` 노출은 참여자 익명성 정책과 무관하다.
- 매핑은 사람이 검토 가능한 산출물(JSON)로 남기고, 임포트는 재실행 안전(idempotent)하게 한다.
- 상세 뷰(모달)를 공유 컴포넌트로 추출해 홈/`/my`가 동일 UI를 쓴다(중복 제거).

## 구성 요소

### 1. DB — `challenge_examples` 테이블 (`supabase/schema.sql`)

```sql
create table if not exists public.challenge_examples (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  cohort        text not null default '22',
  title         text not null,
  summary       text,
  source_url    text,
  source_author text,
  order_index   integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists challenge_examples_challenge_idx
  on public.challenge_examples (challenge_id, order_index);
```

- 챌린지당 여러 사례(1:N). 한 사례글이 두 챌린지에 강하게 관련되면 매핑이 두 행으로 만든다.
- 마이그레이션은 Supabase MCP `apply_migration`으로 적용한다(기존 스키마 파일에도 반영).

### 2. 추출 — `scripts/extract-case-meta.mjs`

- 옵시디언 사례글 폴더의 각 `.md`에서 frontmatter + "## 핵심 요약" 블록을 파싱해
  compact JSON(`scripts/data/case-meta.json`)으로 저장한다.
- 필드: `file`, `title`, `summary`, `tools[]`, `tags[]`, `sourceUrl`, `sourceAuthor`.
- 옵시디언 경로는 상수/인자로. 볼트가 없으면 명확히 실패.

### 3. 매핑 — Workflow(LLM) + 사용자 검토

- `case-meta.json`(99건) + 챌린지 43개 제목/레벨/영역을 입력으로, 사례글별 최적 챌린지(1~2개)를
  신뢰도·근거와 함께 배정한다. 대량이므로 Workflow로 배치 병렬 처리 후 검증 패스를 거친다.
- 산출물 `scripts/data/case-study-mapping.json`:
  ```json
  [
    {
      "file": "오픈클로 설치 텔레그램 연결 범블비.md",
      "assignments": [
        { "challengeTitle": "오픈클로 or 헤르메스 설치", "confidence": "high" },
        { "challengeTitle": "텔레그램 연결 성공!", "confidence": "medium" }
      ]
    }
  ]
  ```
- **여기서 멈추고 사용자가 검토·수정**한다. 승인 후 임포트로 진행.

### 4. 임포트 — `scripts/import-case-studies.mjs`

- `case-study-mapping.json` + `case-meta.json`을 읽고, 챌린지 제목→challenge_id를 DB에서 해석한다.
  해석 실패(제목 불일치) 시 건너뛰지 않고 목록으로 경고한다.
- `challenge_examples`의 기존 22기 행을 지우고 다시 삽입(idempotent, 재실행 안전).
- `order_index`는 confidence(high→low) 순으로 부여.
- dry-run 기본, `--confirm`으로 반영. 반영 전 건수 요약 출력.

### 5. UI — 공유 상세 뷰 "선배 사례" 섹션

- 현재 `/my`의 `ChallengeDetailModal`을 공유 컴포넌트(`src/components/challenge-detail.tsx`)로
  추출한다. 챌린지별 사례를 카드 목록으로 렌더: 제목(→ `source_url` 새 탭 링크, `rel="noopener"`),
  원작자, 요약. 사례 없으면 섹션 숨김.
- **공개 홈(/)**: 챌린지별 완료 현황 항목을 클릭하면 읽기 전용 상세(토글 없음)가 열려 사례를 보여준다.
  이를 위해 홈 챌린지 리스트를 클라이언트 컴포넌트로 감싸 모달을 연다.
- **/my**: 기존 토글 유지 + 사례 노출.
- 데이터 로딩: 챌린지 조회 시 `challenge_examples`를 함께 가져와 challenge_id로 그룹핑하는
  헬퍼(`src/lib/examples.ts`)를 추가한다.

### 6. 데이터 흐름

```
옵시디언 사례글 99개
   │  extract-case-meta.mjs
   ▼
scripts/data/case-meta.json ──┐
                              │  Workflow(LLM 매핑 + 검증)
   챌린지 43개 제목 ───────────┘
   ▼
scripts/data/case-study-mapping.json  ──(사용자 검토)──┐
                                                      │  import-case-studies.mjs
scripts/data/case-meta.json ──────────────────────────┘
   ▼
challenge_examples (DB)  ──(challenge_id 그룹핑)──▶  / , /my 상세 모달 "선배 사례"
```

## 범위 밖 (YAGNI)

- `/archive/22`는 최종 순위 전용으로 그대로 둔다(사례는 라이브 챌린지에만 붙임).
- 관리자 화면에서의 사례 CRUD(이번엔 스크립트 임포트만; 필요 시 후속).
- 사례글 본문 전체 복제(요약 + 원문 링크만; 원문은 gpters.org에 있음).

## 테스트

- `extract-case-meta.mjs`의 frontmatter/요약 파싱 로직(순수 함수 분리 후 단위 테스트).
- 매핑 해석(제목→ID) 및 사례 그룹핑 헬퍼 단위 테스트.
- 공개 홈 상세 모달이 사례 링크를 렌더하고 새 탭/보안 속성을 갖는지 확인.
- `npm run build` + `npm test` 통과.
</content>
