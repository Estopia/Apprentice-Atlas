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
grant select, insert, update, delete on public.applications to authenticated;
grant all on public.applications to service_role;
