create table public.job_ai_qa_sessions (
  job_id uuid not null references public.jobs(id) on delete cascade,
  session_id uuid not null,
  question_count integer not null default 0 check (question_count between 0 and 2),
  updated_at timestamptz not null default now(),
  primary key (job_id, session_id)
);

alter table public.job_ai_qa_sessions enable row level security;
revoke all on public.job_ai_qa_sessions from public, anon, authenticated;
grant select, insert, update on public.job_ai_qa_sessions to service_role;

create or replace function public.consume_job_ai_question(p_job_id uuid, p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  insert into public.job_ai_qa_sessions (job_id, session_id, question_count)
  values (p_job_id, p_session_id, 1)
  on conflict (job_id, session_id) do update
    set question_count = public.job_ai_qa_sessions.question_count + 1,
        updated_at = now()
    where public.job_ai_qa_sessions.question_count < 2
  returning question_count into next_count;
  return next_count;
end;
$$;

revoke execute on function public.consume_job_ai_question(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_job_ai_question(uuid, uuid) to service_role;

create or replace function public.release_job_ai_question(p_job_id uuid, p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  update public.job_ai_qa_sessions
  set question_count = question_count - 1, updated_at = now()
  where job_id = p_job_id and session_id = p_session_id and question_count > 0
  returning question_count into next_count;
  return next_count;
end;
$$;

revoke execute on function public.release_job_ai_question(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_job_ai_question(uuid, uuid) to service_role;
