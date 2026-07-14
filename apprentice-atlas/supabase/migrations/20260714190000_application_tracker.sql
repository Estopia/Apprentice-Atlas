create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null default 'interested'
    check (status in ('interested', 'preparing', 'applied', 'interview', 'offer', 'closed')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index applications_user_status_idx on public.applications (user_id, status);
create index applications_user_updated_at_idx on public.applications (user_id, updated_at desc);
create index applications_job_id_idx on public.applications (job_id);

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

alter table public.applications enable row level security;

create policy "Users can read their own applications"
on public.applications for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own applications"
on public.applications for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own applications"
on public.applications for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own applications"
on public.applications for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.applications from public;
revoke all on public.applications from anon;
grant select, update, delete on public.applications to authenticated;
grant all on public.applications to service_role;

-- Keep ownership and job availability inside the database boundary. Existing
-- applications remain editable when a listing later expires.
create or replace function public.upsert_application(p_job_id uuid, p_status text, p_note text)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  tracked public.applications;
  normalized_note text := nullif(btrim(p_note), '');
  available boolean;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_status not in ('interested', 'preparing', 'applied', 'interview', 'offer', 'closed') then
    raise exception 'Invalid application status' using errcode = '22023';
  end if;

  if normalized_note is not null and char_length(normalized_note) > 500 then
    raise exception 'Application note cannot exceed 500 characters' using errcode = '22001';
  end if;

  -- Serialize one user's writes for one job so concurrent first saves cannot
  -- bypass the availability check through ON CONFLICT.
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text || ':' || p_job_id::text, 0));

  select * into tracked
  from public.applications
  where user_id = caller_id
    and job_id = p_job_id;

  if found then
    update public.applications
    set status = p_status,
        note = normalized_note
    where id = tracked.id
      and user_id = caller_id
    returning * into tracked;
    return tracked;
  end if;

  -- Lock the job row while creating the tracker entry. A listing that expires
  -- concurrently is either rejected first or becomes expired after this
  -- transaction, while the user's historical tracker entry remains intact.
  select true into available
  from public.jobs
  where jobs.id = p_job_id
    and jobs.status = 'active'
    and (jobs.expires_at is null or jobs.expires_at > now())
  for update;

  if not coalesce(available, false) then
    raise exception 'Job is not available for application tracking' using errcode = 'P0002';
  end if;

  insert into public.applications (user_id, job_id, status, note)
  values (caller_id, p_job_id, p_status, normalized_note)
  returning * into tracked;

  return tracked;
end;
$$;

revoke execute on function public.upsert_application(uuid, text, text) from public;
revoke execute on function public.upsert_application(uuid, text, text) from anon;
grant execute on function public.upsert_application(uuid, text, text) to authenticated;

-- Direct inserts stay unavailable even though the insert RLS policy documents
-- the owner invariant and protects privileged callers that opt into RLS.
revoke insert on public.applications from authenticated;
