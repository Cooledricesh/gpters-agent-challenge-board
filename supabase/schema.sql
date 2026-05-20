-- GPTERS 반려 에이전트 챌린지 보드 — 스키마
-- 적용 방법: Supabase SQL Editor 또는 `supabase db push`.
-- 설계 원칙:
--   * 수강생 비밀번호는 관리자가 직접 지정하고 password_hash만 보관한다.
--   * anonymous_label("챌린저 01")은 공개 페이지 노출용. nickname은 관리자만 본다.
--   * 챌린지는 날짜 없음. order_index 오름차순으로 표시.
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
  -- 표시 순서. 관리자 등록 순으로 자동 증가시키되 수동 정렬도 허용.
  order_index integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists challenges_order_idx
  on public.challenges (order_index, created_at);

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
