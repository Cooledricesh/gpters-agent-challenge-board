-- Roll back only the additive canonical snapshot RPC.
-- This does not modify domain tables or data.

drop function if exists public.migration_snapshot_v1();
