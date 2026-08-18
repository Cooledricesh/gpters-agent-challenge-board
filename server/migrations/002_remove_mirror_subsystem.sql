-- Remove the abandoned mirror/replay subsystem from an existing NAS database.
-- Domain tables and their data are intentionally untouched.

lock table public.app_users,
  public.challenges,
  public.challenge_examples,
  public.completions
  in share row exclusive mode;

drop trigger if exists guard_nas_app_users on public.app_users;
drop trigger if exists guard_nas_challenges on public.challenges;
drop trigger if exists guard_nas_challenge_examples on public.challenge_examples;
drop trigger if exists guard_nas_completions on public.completions;
drop function if exists public.guard_nas_domain_write_v1();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop table if exists public.nas_mutation_journal cascade;
drop table if exists public.nas_mutation_versions cascade;
drop table if exists public.nas_mutation_requests cascade;
drop table if exists public.nas_mutation_runtime_control cascade;
drop table if exists public.migration_parent_tombstones cascade;
drop table if exists public.migration_apply_ledger cascade;
drop table if exists public.migration_apply_versions cascade;
