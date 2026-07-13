-- Apprentice Atlas initial schema.
-- Ingestion is performed by trusted Edge Functions/service-role code only.

create extension if not exists pgcrypto;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  country text not null,
  city text not null,
  latitude double precision,
  longitude double precision,
  job_type text not null,
  level text not null,
  category text not null,
  tags text[] not null default '{}',
  raw_description text not null,
  requirements text[] not null default '{}',
  source_url text not null,
  source_name text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'invalid')),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create table public.job_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  provider text not null,
  external_id text not null,
  source_url text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'retired', 'invalid')),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  source_key text not null,
  status text not null check (status in ('running', 'succeeded', 'failed', 'partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched_count integer not null default 0 check (fetched_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  expired_count integer not null default 0 check (expired_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  error_details jsonb,
  created_at timestamptz not null default now(),
  check (
    provider <> ''
    and source_key <> ''
    and source_key like provider || ':%'
  )
);

create table public.job_translations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  language_code text not null check (language_code in ('de', 'en')),
  title text not null,
  company text not null,
  description text not null,
  requirements text[] not null default '{}',
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, language_code),
  check (
    (status = 'published' and published_at is not null)
    or (status in ('draft', 'archived') and published_at is null)
  )
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table public.job_ai_content (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  language_code text not null check (language_code in ('de', 'en')),
  content_type text not null check (content_type in ('explanation', 'question_answer')),
  cache_key text not null,
  summary text,
  fit_reasons text[] not null default '{}',
  considerations text[] not null default '{}',
  question text,
  answer text,
  grounded boolean,
  model text not null,
  prompt_version text not null,
  source_content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, language_code, cache_key),
  check (
    (content_type = 'explanation' and summary is not null and question is null and answer is null)
    or (content_type = 'question_answer' and question is not null and answer is not null and grounded is not null)
  )
);

create index jobs_country_idx on public.jobs (country);
create index jobs_city_idx on public.jobs (city);
create index jobs_status_idx on public.jobs (status);
create index jobs_category_idx on public.jobs (category);
create index jobs_job_type_idx on public.jobs (job_type);
create index jobs_active_status_idx on public.jobs (status) where status = 'active';
create index jobs_coordinates_idx on public.jobs (latitude, longitude);
create index jobs_tags_gin_idx on public.jobs using gin (tags);
create index job_sources_job_id_idx on public.job_sources (job_id);
create index sync_runs_provider_source_started_idx on public.sync_runs (provider, source_key, started_at desc);
create index job_translations_job_status_idx on public.job_translations (job_id, status);
create index favorites_user_id_idx on public.favorites (user_id);
create index job_ai_content_job_idx on public.job_ai_content (job_id, language_code);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create trigger job_sources_set_updated_at
before update on public.job_sources
for each row execute function public.set_updated_at();

create trigger job_translations_set_updated_at
before update on public.job_translations
for each row execute function public.set_updated_at();

create trigger job_ai_content_set_updated_at
before update on public.job_ai_content
for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;
alter table public.job_sources enable row level security;
alter table public.sync_runs enable row level security;
alter table public.job_translations enable row level security;
alter table public.favorites enable row level security;
alter table public.job_ai_content enable row level security;

create policy "Anyone can read active jobs"
on public.jobs for select
to anon, authenticated
using (status = 'active' and (expires_at is null or expires_at > now()));

create policy "Anyone can read published translations for active jobs"
on public.job_translations for select
to anon, authenticated
using (
  status = 'published'
  and (published_at is not null)
  and exists (
    select 1 from public.jobs
    where jobs.id = job_translations.job_id
      and jobs.status = 'active'
      and (jobs.expires_at is null or jobs.expires_at > now())
  )
);

create policy "Users can read their own favorites"
on public.favorites for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own favorites"
on public.favorites for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own favorites"
on public.favorites for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Client roles intentionally receive no policies for job_sources, sync_runs,
-- or job_ai_content. Trusted ingestion/AI Edge Functions use service_role.
grant select on public.jobs, public.job_translations to anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant all on public.jobs, public.job_sources, public.sync_runs, public.job_translations,
  public.favorites, public.job_ai_content to service_role;
