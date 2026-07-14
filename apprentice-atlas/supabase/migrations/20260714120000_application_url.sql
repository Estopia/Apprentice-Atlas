alter table public.jobs add column if not exists application_url text;
alter table public.jobs alter column source_url drop not null;
alter table public.job_sources alter column source_url drop not null;

-- Keep the client limited to normalized, active job data.
grant select on public.jobs to anon, authenticated;
