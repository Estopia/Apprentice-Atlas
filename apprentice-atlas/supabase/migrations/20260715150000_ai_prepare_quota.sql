create schema if not exists private;

revoke all on schema private from public, anon, authenticated, service_role;

create table private.ai_prepare_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  usage_count integer not null check (usage_count between 0 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, window_started_at)
);

revoke all on private.ai_prepare_usage from public, anon, authenticated, service_role;

-- Fixed product limit: five AI preparation generations per authenticated user
-- per UTC clock hour. The returned window is the reservation token used for a
-- compensating release if OpenAI does not produce a valid result.
create or replace function public.reserve_ai_prepare_quota(p_user_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  ai_prepare_hourly_quota constant integer := 5;
  quota_window timestamptz := pg_catalog.date_trunc('hour', pg_catalog.clock_timestamp());
  reserved_window timestamptz;
begin
  if p_user_id is null then
    return null;
  end if;

  insert into private.ai_prepare_usage (user_id, window_started_at, usage_count, updated_at)
  values (p_user_id, quota_window, 1, pg_catalog.clock_timestamp())
  on conflict (user_id, window_started_at) do update
    set usage_count = private.ai_prepare_usage.usage_count + 1,
        updated_at = pg_catalog.clock_timestamp()
    where private.ai_prepare_usage.usage_count < ai_prepare_hourly_quota
  returning window_started_at into reserved_window;

  return reserved_window;
end;
$$;

create or replace function public.release_ai_prepare_quota(p_user_id uuid, p_window_started_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  released_count integer;
begin
  update private.ai_prepare_usage
  set usage_count = usage_count - 1,
      updated_at = pg_catalog.clock_timestamp()
  where user_id = p_user_id
    and window_started_at = p_window_started_at
    and usage_count > 0;

  get diagnostics released_count = row_count;
  return released_count = 1;
end;
$$;

revoke execute on function public.reserve_ai_prepare_quota(uuid) from public, anon, authenticated;
grant execute on function public.reserve_ai_prepare_quota(uuid) to service_role;
revoke execute on function public.release_ai_prepare_quota(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.release_ai_prepare_quota(uuid, timestamptz) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.reserve_ai_prepare_quota(uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.reserve_ai_prepare_quota(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.release_ai_prepare_quota(uuid,timestamptz)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.release_ai_prepare_quota(uuid,timestamptz)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.reserve_ai_prepare_quota(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.release_ai_prepare_quota(uuid,timestamptz)', 'EXECUTE') then
    raise exception 'AI preparation quota RPC privileges are not locked to service_role';
  end if;
end;
$$;
