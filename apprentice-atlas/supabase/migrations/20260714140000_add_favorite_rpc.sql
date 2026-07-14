-- Keep favorite ownership inside the database boundary. The client supplies
-- only a job id; the authenticated Supabase session supplies the owner.

create or replace function public.add_favorite(p_job_id uuid)
returns public.favorites
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  favorite public.favorites;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.jobs
    where jobs.id = p_job_id
      and jobs.status = 'active'
      and (jobs.expires_at is null or jobs.expires_at > now())
  ) then
    raise exception 'Job is not available for saving' using errcode = 'P0002';
  end if;

  insert into public.favorites (user_id, job_id)
  values (caller_id, p_job_id)
  on conflict (user_id, job_id) do nothing
  returning * into favorite;

  if favorite.id is null then
    select * into favorite
    from public.favorites
    where user_id = caller_id
      and job_id = p_job_id;
  end if;

  return favorite;
end;
$$;

revoke execute on function public.add_favorite(uuid) from public;
revoke execute on function public.add_favorite(uuid) from anon;
grant execute on function public.add_favorite(uuid) to authenticated;

-- All authenticated inserts must go through add_favorite. Read and delete
-- access remain governed by the existing RLS policies.
revoke insert on public.favorites from authenticated;

-- Keep public job visibility aligned with what can be favorited when an
-- ingestion run has not yet changed status to expired.
drop policy if exists "Anyone can read active jobs" on public.jobs;
create policy "Anyone can read active jobs"
on public.jobs for select
to anon, authenticated
using (status = 'active' and (expires_at is null or expires_at > now()));

drop policy if exists "Anyone can read published translations for active jobs" on public.job_translations;
create policy "Anyone can read published translations for active jobs"
on public.job_translations for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1 from public.jobs
    where jobs.id = job_translations.job_id
      and jobs.status = 'active'
      and (jobs.expires_at is null or jobs.expires_at > now())
  )
);

do $$
begin
  if has_function_privilege('anon', 'public.add_favorite(uuid)', 'execute') then
    raise exception 'add_favorite must not be executable by anon';
  end if;
  if not has_function_privilege('authenticated', 'public.add_favorite(uuid)', 'execute') then
    raise exception 'add_favorite must be executable by authenticated';
  end if;
end;
$$;
