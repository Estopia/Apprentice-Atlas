-- Atomically retire stale source rows and expire only jobs with no remaining
-- active source. The function is callable by trusted ingestion only.

create or replace function public.expire_stale_source_jobs(
  p_provider text,
  p_seen_before timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.job_sources
  set status = 'retired'
  where provider = p_provider
    and status = 'active'
    and fetched_at < p_seen_before;

  update public.jobs as jobs
  set status = 'expired', updated_at = p_seen_before
  where jobs.status = 'active'
    and exists (
      select 1
      from public.job_sources as retired_sources
      where retired_sources.job_id = jobs.id
        and retired_sources.provider = p_provider
        and retired_sources.status = 'retired'
        and retired_sources.fetched_at < p_seen_before
    )
    and not exists (
      select 1
      from public.job_sources as remaining_sources
      where remaining_sources.job_id = jobs.id
        and remaining_sources.status = 'active'
    );

  get diagnostics expired_count = row_count;

  return expired_count;
end;
$$;

-- REVOKE/GRANT are idempotent and make the server-only boundary explicit.
revoke execute on function public.expire_stale_source_jobs(text, timestamptz) from public;
revoke execute on function public.expire_stale_source_jobs(text, timestamptz) from anon;
revoke execute on function public.expire_stale_source_jobs(text, timestamptz) from authenticated;
grant execute on function public.expire_stale_source_jobs(text, timestamptz) to service_role;

do $$
begin
  if exists (
    select 1
    from aclexplode((
      select proacl
      from pg_proc
      where oid = 'public.expire_stale_source_jobs(text, timestamptz)'::regprocedure
    ))
    where grantee = 0 and privilege_type = 'EXECUTE'
  ) then
    raise exception 'expire_stale_source_jobs must not be executable by PUBLIC';
  end if;
  if has_function_privilege('anon', 'public.expire_stale_source_jobs(text, timestamptz)', 'execute') then
    raise exception 'expire_stale_source_jobs must not be executable by anon';
  end if;
  if has_function_privilege('authenticated', 'public.expire_stale_source_jobs(text, timestamptz)', 'execute') then
    raise exception 'expire_stale_source_jobs must not be executable by authenticated';
  end if;
  if not has_function_privilege('service_role', 'public.expire_stale_source_jobs(text, timestamptz)', 'execute') then
    raise exception 'expire_stale_source_jobs must be executable by service_role';
  end if;
end;
$$;
