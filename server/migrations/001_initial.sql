-- Portable PostgreSQL 17 schema for the NAS shadow database.
-- Applied transactionally by dbctl as gpters_challenge_board_owner.

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  nickname text not null unique,
  role text not null default 'student' check (role in ('student', 'admin')),
  password_hash text,
  anonymous_label text unique,
  anonymous_index integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index app_users_role_idx on public.app_users (role);
create index app_users_anonymous_index_idx on public.app_users (anonymous_index);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  detail text,
  level text not null default 'basic' check (level in ('basic', 'advanced')),
  area text check (area in (
    'start', 'channel', 'automation', 'content', 'operations',
    'integrations', 'orchestration', 'build', 'voice-ui', 'edge', 'other'
  )),
  order_index integer not null default 0,
  tier integer not null default 1 check (tier in (1, 2, 3)),
  prerequisite_id uuid references public.challenges (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index challenges_order_idx on public.challenges (order_index, created_at);
create index challenges_level_order_idx on public.challenges (level, order_index, created_at);
create index challenges_area_order_idx on public.challenges (level, area, order_index, created_at);
create index challenges_prerequisite_idx on public.challenges (prerequisite_id);
create index challenges_tier_order_idx on public.challenges (tier, order_index, created_at);

create table public.challenge_examples (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  cohort text not null default '22',
  title text not null,
  summary text,
  source_url text,
  source_author text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index challenge_examples_challenge_idx
  on public.challenge_examples (challenge_id, order_index);

create table public.completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);

create index completions_user_idx on public.completions (user_id);
create index completions_challenge_idx on public.completions (challenge_id);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger app_users_set_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();

create trigger challenges_set_updated_at
  before update on public.challenges
  for each row execute function public.set_updated_at();
