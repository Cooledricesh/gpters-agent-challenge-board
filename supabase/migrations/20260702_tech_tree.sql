-- 20260702_tech_tree.sql
-- 23기 기술트리: 과제에 티어(난이도=점수)와 단일 선행과제를 추가.
-- 적용: Supabase SQL Editor에 붙여넣어 실행(기존 스키마에 안전하게 add-only).
--
--   * tier: 1(기초, 1점) / 2(활용, 1.25점) / 3(심화, 1.5점)
--   * prerequisite_id: 단일 선행과제(진짜 트리). 뿌리 과제만 null.
--     선행 과제 삭제 시 고아가 되지 않도록 set null.

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
