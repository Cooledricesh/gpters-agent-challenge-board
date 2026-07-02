-- GPTERS 반려 에이전트 챌린지 보드 — 스키마
-- 적용 방법: Supabase SQL Editor 또는 `supabase db push`.
-- 설계 원칙:
--   * 수강생 비밀번호는 관리자가 직접 지정하고 password_hash만 보관한다.
--   * anonymous_label("챌린저 01")은 공개 페이지 노출용. nickname은 관리자만 본다.
--   * 챌린지는 날짜 없음. level별로 분리하고, 각 섹션 안에서는 order_index 오름차순으로 표시.
--   * 수강생 완료 토글: completions 테이블 (user_id, challenge_id) 유니크.

-- =========================
-- 1. app_users
-- =========================
create table if not exists public.app_users (
  id              uuid primary key default gen_random_uuid(),
  nickname        text not null unique,
  role            text not null default 'student' check (role in ('student', 'admin')),
  -- 수강생 비밀번호 해시 (bcrypt). 관리자는 ADMIN_PASSWORD env로 대체될 수 있어 nullable.
  password_hash   text,
  -- 공개 페이지 노출용 익명 라벨. 예: "챌린저 01".
  anonymous_label text unique,
  -- 라벨 발급 순번. 운영자가 수강생 등록 순으로 자동 증가.
  anonymous_index integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 이전 버전에서 생성된 legacy credential helper 컬럼 제거. 새 설치에서는 아무 일도 하지 않는다.
alter table public.app_users drop column if exists phone_last2;

create index if not exists app_users_role_idx
  on public.app_users (role);

create index if not exists app_users_anonymous_index_idx
  on public.app_users (anonymous_index);

-- =========================
-- 2. challenges
-- =========================
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  detail      text,
  -- basic=기본 과제, advanced=고급 과제.
  level       text not null default 'basic' check (level in ('basic', 'advanced')),
  -- 영역 그룹. null이면 앱이 제목 기반 자동 분류로 보조 처리한다.
  area        text check (area in (
                'start', 'channel', 'automation', 'content', 'operations',
                'integrations', 'orchestration', 'build', 'voice-ui', 'edge', 'other'
              )),
  -- 표시 순서. 관리자 등록 순으로 자동 증가시키되 수동 정렬도 허용.
  order_index integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 기존 테이블에 level 컬럼이 없는 경우 추가한다. 기존 챌린지는 기본 과제로 둔다.
alter table public.challenges
  add column if not exists level text not null default 'basic';

-- 참여자가 챌린지 항목을 클릭했을 때 모달에 보여줄 긴 상세 안내.
-- description은 보드에 짧게 보이는 요약, detail은 수행 방법/완료 기준/예시 등 긴 내용을 담는다.
alter table public.challenges
  add column if not exists detail text;

-- 챌린지 영역 그룹. 운영 중에는 관리자 화면/DB에서 직접 지정하고, null이면 앱의 제목 기반 보조 분류를 사용한다.
alter table public.challenges
  add column if not exists area text;

update public.challenges
set level = 'basic'
where level is null or level not in ('basic', 'advanced');

update public.challenges
set area = null
where area is not null
  and area not in (
    'start', 'channel', 'automation', 'content', 'operations',
    'integrations', 'orchestration', 'build', 'voice-ui', 'edge', 'other'
  );

-- 기존 행은 현재 앱의 제목 기반 보조 분류와 같은 기준으로 area를 한 번 채운다.
-- 이후부터는 관리자 화면/DB에서 area를 직접 바꾸면 코드 수정 없이 반영된다.
update public.challenges
set area = case
  when level = 'basic' and (
    lower(title) like '%설치%' or lower(title) like '%soul%' or lower(title) like '%대시보드%'
  ) then 'start'
  when level = 'basic' and (
    lower(title) like '%텔레그램%' or lower(title) like '%두번째%' or lower(title) like '%두 번째%' or
    lower(title) like '%구글 이메일%' or lower(title) like '%캘린더%'
  ) then 'channel'
  when level = 'basic' and (
    lower(title) like '%크론%' or lower(title) like '%날씨%' or lower(title) like '%일정 보고%'
  ) then 'automation'
  when level = 'basic' and (
    lower(title) like '%폴더%' or lower(title) like '%유튜브%' or lower(title) like '%요약%' or lower(title) like '%이미지%'
  ) then 'content'
  when level = 'basic' and (
    lower(title) like '%심폐소생술%' or lower(title) like '%검문소%' or lower(title) like '%유지 보수%' or lower(title) like '%업데이트%'
  ) then 'operations'
  when level = 'basic' then 'other'
  when level = 'advanced' and (
    lower(title) like '%k-skill%' or lower(title) like '%rtk%' or lower(title) like '%옵시디언%' or
    lower(title) like '%슬랙%' or lower(title) like '%디스코드%' or lower(title) like '%카카오톡%' or lower(title) like '%클로드 cli%'
  ) then 'integrations'
  when level = 'advanced' and (
    lower(title) like '%봇투봇%' or lower(title) like '%session_send%' or lower(title) like '%칸반%' or lower(title) like '%그룹톡%'
  ) then 'orchestration'
  when level = 'advanced' and (
    lower(title) like '%대시보드%' or lower(title) like '%llm-wiki%' or lower(title) like '%모델%' or
    lower(title) like '%검은소%' or lower(title) like '%누렁소%' or lower(title) like '%프레젠테이션%' or
    lower(title) like '%ppt%' or lower(title) like '%발표자료%'
  ) then 'build'
  when level = 'advanced' and (
    lower(title) like '%tts%' or lower(title) like '%목소리%' or lower(title) like '%gui%' or lower(title) like '%팟캐스트%'
  ) then 'voice-ui'
  when level = 'advanced' and lower(title) like '%자동 결제%' then 'edge'
  else 'other'
end
where area is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'challenges_level_check'
      and conrelid = 'public.challenges'::regclass
  ) then
    alter table public.challenges
      add constraint challenges_level_check check (level in ('basic', 'advanced'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'challenges_area_check'
      and conrelid = 'public.challenges'::regclass
  ) then
    alter table public.challenges
      add constraint challenges_area_check check (area in (
        'start', 'channel', 'automation', 'content', 'operations',
        'integrations', 'orchestration', 'build', 'voice-ui', 'edge', 'other'
      ));
  end if;
end $$;

create index if not exists challenges_order_idx
  on public.challenges (order_index, created_at);

create index if not exists challenges_level_order_idx
  on public.challenges (level, order_index, created_at);

create index if not exists challenges_area_order_idx
  on public.challenges (level, area, order_index, created_at);

-- 23기 기술트리: 티어(1=기초 1점, 2=활용 1.25점, 3=심화 1.5점)와
-- 단일 선행과제(prerequisite_id, 뿌리만 null). level은 하위 호환용으로 유지하며
-- tier에서 파생(T1→basic, T2/T3→advanced) 세팅한다.
alter table public.challenges
  add column if not exists tier integer not null default 1;

alter table public.challenges
  add column if not exists prerequisite_id uuid references public.challenges (id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'challenges_tier_check'
      and conrelid = 'public.challenges'::regclass
  ) then
    alter table public.challenges
      add constraint challenges_tier_check check (tier in (1, 2, 3));
  end if;
end $$;

create index if not exists challenges_prerequisite_idx
  on public.challenges (prerequisite_id);

create index if not exists challenges_tier_order_idx
  on public.challenges (tier, order_index, created_at);

-- =========================
-- 2-1. challenge_examples (선배 사례글)
-- =========================
-- 이전 기수 참여자가 gpters.org에 발표한 사례글을 챌린지에 연결한다.
--   * 챌린지 상세(모달)에서 "선배 사례"로 노출. challenge_id 1:N.
--   * gpters.org 공개 글이므로 source_author/source_url 노출은 참여자 익명성과 무관.
--   * scripts/import-case-studies.mjs 로 옵시디언 수집본에서 적재(cohort별 교체, idempotent).
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

-- =========================
-- 3. completions
-- =========================
create table if not exists public.completions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.app_users (id) on delete cascade,
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  completed_at  timestamptz not null default now(),
  -- 동일 (수강생, 챌린지) 중복 체크 금지. 토글 시 row 삭제 후 재삽입.
  unique (user_id, challenge_id)
);

create index if not exists completions_user_idx
  on public.completions (user_id);

create index if not exists completions_challenge_idx
  on public.completions (challenge_id);

-- =========================
-- updated_at 자동 갱신 트리거
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();

drop trigger if exists challenges_set_updated_at on public.challenges;
create trigger challenges_set_updated_at
  before update on public.challenges
  for each row execute function public.set_updated_at();
