-- 20260701_challenge_examples.sql
-- challenge_examples: 이전 기수 선배 사례글을 챌린지에 연결.
-- 적용: Supabase SQL Editor에 붙여넣어 실행(기존 스키마에 안전하게 add-only).

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
