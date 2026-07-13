-- Apprentice Atlas schema hardening.
-- This migration is intentionally separate from 001 so the initial Task 2
-- schema remains reproducible and its integrity fixes are independently clear.

-- A sync run represents a provider configuration run, not one listing.
alter table public.sync_runs
  add column if not exists source_key text;

alter table public.sync_runs
  add column if not exists source_provider text;

alter table public.sync_runs
  add column if not exists legacy_source_key text;

-- Remove earlier versions of these checks before normalizing legacy rows. This
-- also supports the intermediate schema where source_key already existed.
alter table public.job_sources
  drop constraint if exists job_sources_provider_external_id_check;

alter table public.sync_runs
  drop constraint if exists sync_runs_source_provider_check;

alter table public.sync_runs
  drop constraint if exists sync_runs_provider_source_key_check;

-- 19da9cb used an unnamed inline source-key check, which PostgreSQL named
-- sync_runs_check. Remove it before normalizing that intermediate schema.
alter table public.sync_runs
  drop constraint if exists sync_runs_check;

update public.sync_runs
set provider = case
  when btrim(provider) = '' then 'legacy-run-' || id::text
  else btrim(provider)
end;

-- Preserve provenance from the old per-listing FK while source_id still exists.
-- source_provider captures the listing provider; source_key keeps the provider
-- that performed the sync as its prefix.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sync_runs'
      and column_name = 'source_id'
  ) then
    execute $source_provider_backfill$
      update public.sync_runs as runs
      set source_provider = btrim(sources.provider)
      from public.job_sources as sources
      where runs.source_id = sources.id
        and (runs.source_provider is null or btrim(runs.source_provider) = '')
    $source_provider_backfill$;

    execute $backfill$
      update public.sync_runs as runs
      set source_key = runs.provider || ':' || btrim(sources.external_id)
      from public.job_sources as sources
      where runs.source_id = sources.id
        and btrim(sources.external_id) <> ''
        and (runs.source_key is null or btrim(runs.source_key) = '')
    $backfill$;
  end if;
end
$$;

update public.sync_runs
set source_provider = nullif(btrim(source_provider), '')
where source_provider is not null;

-- Keep any non-empty legacy key that is not valid under the normalized
-- provider in a nullable audit column, then replace it with a valid key.
update public.sync_runs as runs
set legacy_source_key = runs.source_key
where btrim(runs.source_key) <> ''
  and (
    runs.source_key <> btrim(runs.source_key)
    or left(runs.source_key, length(runs.provider) + 1) <> runs.provider || ':'
    or length(runs.source_key) <= length(runs.provider) + 1
  )
  and (runs.legacy_source_key is null or btrim(runs.legacy_source_key) = '');

update public.sync_runs as runs
set source_key = runs.provider || ':legacy-run-' || runs.id::text
where runs.source_key is null
   or btrim(runs.source_key) = ''
   or runs.source_key <> btrim(runs.source_key)
   or left(runs.source_key, length(runs.provider) + 1) <> runs.provider || ':'
   or length(runs.source_key) <= length(runs.provider) + 1;

-- The old FK has now served its backfill purpose and is no longer part of the
-- provider-configuration provenance model.
alter table public.sync_runs
  drop column if exists source_id;

alter table public.sync_runs
  alter column source_key set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sync_runs'::regclass
      and conname = 'sync_runs_source_provider_check'
  ) then
    alter table public.sync_runs
      add constraint sync_runs_source_provider_check
      check (
        source_provider is null
        or (btrim(source_provider) = source_provider and btrim(source_provider) <> '')
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sync_runs'::regclass
      and conname = 'sync_runs_provider_source_key_check'
  ) then
    alter table public.sync_runs
      add constraint sync_runs_provider_source_key_check
      check (
        btrim(provider) = provider
        and btrim(provider) <> ''
        and btrim(source_key) = source_key
        and btrim(source_key) <> ''
        and left(source_key, length(provider) + 1) = provider || ':'
        and length(source_key) > length(provider) + 1
      );
  end if;
end
$$;

drop index if exists public.sync_runs_provider_started_idx;
create index if not exists sync_runs_provider_source_started_idx
  on public.sync_runs (provider, source_key, started_at desc);

create index if not exists jobs_tags_gin_idx
  on public.jobs using gin (tags);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_translations'::regclass
      and conname = 'job_translations_published_at_status_check'
  ) then
    alter table public.job_translations
      add constraint job_translations_published_at_status_check
      check (
        (status = 'published' and published_at is not null)
        or (status in ('draft', 'archived') and published_at is null)
      );
  end if;
end
$$;

-- Public listings must be active and not past their optional expiry. A NULL
-- expires_at means the source has not supplied an expiry and remains visible.
drop policy if exists "Anyone can read active jobs" on public.jobs;
create policy "Anyone can read active jobs"
on public.jobs for select
to anon, authenticated
using (status = 'active' and (expires_at is null or expires_at > now()));

drop policy if exists "Anyone can read published translations for active jobs"
  on public.job_translations;
create policy "Anyone can read published translations for active jobs"
on public.job_translations for select
to anon, authenticated
using (
  status = 'published'
  and published_at is not null
  and exists (
    select 1 from public.jobs
    where jobs.id = job_translations.job_id
      and jobs.status = 'active'
      and (jobs.expires_at is null or jobs.expires_at > now())
  )
);
