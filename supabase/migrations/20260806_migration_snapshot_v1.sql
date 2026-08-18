-- One-statement, transaction-consistent migration snapshot for the four domain tables.
-- Additive only. Restricted to Supabase service_role; never callable by browser roles.

create or replace function public.migration_snapshot_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'schema_version', 1,
    'source', 'supabase_rpc_migration_snapshot_v1',
    'consistency', 'transaction_consistent_single_statement',
    'snapshot_at', transaction_timestamp(),
    'app_users', coalesce(
      (select jsonb_agg(to_jsonb(row_data) order by row_data.id)
       from public.app_users as row_data),
      '[]'::jsonb
    ),
    'challenges', coalesce(
      (select jsonb_agg(to_jsonb(row_data) order by row_data.id)
       from public.challenges as row_data),
      '[]'::jsonb
    ),
    'challenge_examples', coalesce(
      (select jsonb_agg(to_jsonb(row_data) order by row_data.id)
       from public.challenge_examples as row_data),
      '[]'::jsonb
    ),
    'completions', coalesce(
      (select jsonb_agg(to_jsonb(row_data) order by row_data.id)
       from public.completions as row_data),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.migration_snapshot_v1() from public;
revoke all on function public.migration_snapshot_v1() from anon;
revoke all on function public.migration_snapshot_v1() from authenticated;
grant execute on function public.migration_snapshot_v1() to service_role;

comment on function public.migration_snapshot_v1() is
  'Server-only one-statement snapshot used for verified Supabase-to-NAS migration rehearsals.';
