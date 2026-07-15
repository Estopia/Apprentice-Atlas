alter table public.applications
add column interview_at timestamptz;

-- Re-state the narrow table privileges after adding the private tracker field.
-- Inserts continue to flow through the validated owner-scoped RPC.
revoke all on public.applications from public;
revoke all on public.applications from anon;
revoke all on public.applications from authenticated;
grant select, delete on public.applications to authenticated;
grant update (status, note, interview_at) on public.applications to authenticated;
grant all on public.applications to service_role;
revoke insert on public.applications from authenticated;

drop function public.upsert_application(uuid, text, text);

create function public.upsert_application(
  p_job_id uuid,
  p_status text,
  p_note text,
  p_interview_at timestamptz default null
)
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

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text || ':' || p_job_id::text, 0));

  select * into tracked
  from public.applications
  where user_id = caller_id
    and job_id = p_job_id;

  if found then
    update public.applications
    set status = p_status,
        note = normalized_note,
        interview_at = p_interview_at
    where id = tracked.id
      and user_id = caller_id
    returning * into tracked;
    return tracked;
  end if;

  select true into available
  from public.jobs
  where jobs.id = p_job_id
    and jobs.status = 'active'
    and (jobs.expires_at is null or jobs.expires_at > now())
  for update;

  if not coalesce(available, false) then
    raise exception 'Job is not available for application tracking' using errcode = 'P0002';
  end if;

  insert into public.applications (user_id, job_id, status, note, interview_at)
  values (caller_id, p_job_id, p_status, normalized_note, p_interview_at)
  returning * into tracked;

  return tracked;
end;
$$;

revoke execute on function public.upsert_application(uuid, text, text, timestamptz) from public;
revoke execute on function public.upsert_application(uuid, text, text, timestamptz) from anon;
grant execute on function public.upsert_application(uuid, text, text, timestamptz) to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.upsert_application(uuid,text,text,timestamptz)', 'execute') then
    raise exception 'upsert_application must not be executable by anon';
  end if;
  if not has_function_privilege('authenticated', 'public.upsert_application(uuid,text,text,timestamptz)', 'execute') then
    raise exception 'upsert_application must be executable by authenticated';
  end if;
end;
$$;
