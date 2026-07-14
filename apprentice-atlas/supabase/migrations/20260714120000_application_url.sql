alter table public.jobs add column if not exists application_url text;

-- Keep the client limited to normalized, active job data.
grant select on public.jobs to anon, authenticated;
