-- Apprentice Atlas schema hardening.
-- This migration is intentionally separate from 001 so the initial Task 2
-- schema remains reproducible and its integrity fixes are independently clear.

-- A sync run represents a provider configuration run, not one listing.
alter table public.sync_runs
  add column if not exists source_key text;

-- Preserve provenance from the old per-listing FK while both source_id and its
-- FK still exist. A dynamic block makes this safe to rerun after source_id is
-- removed by this migration.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sync_runs'
      and column_name = 'source_id'
  ) then
    execute $backfill$
      update public.sync_runs as runs
      set source_key = sources.provider || ':' || sources.external_id
      from public.job_sources as sources
      where runs.source_id = sources.id
        and (runs.source_key is null or btrim(runs.source_key) = '')
    $backfill$;

    -- Rows whose old source_id cannot be joined, plus rows without one, retain
    -- a deterministic provider-scoped fallback rather than losing run identity.
    execute $fallback$
      update public.sync_runs as runs
      set source_key = runs.provider || ':legacy-' || coalesce(runs.source_id::text, runs.id::text)
      where (runs.source_key is null or btrim(runs.source_key) = '')
        and not exists (
          select 1
          from public.job_sources as sources
          where sources.id = runs.source_id
        )
    $fallback$;
  else
    -- This is the rerun path: source_id was already removed, so only fill
    -- genuinely empty keys with a deterministic legacy value.
    update public.sync_runs as runs
    set source_key = runs.provider || ':legacy-' || runs.id::text
    where runs.source_key is null or btrim(runs.source_key) = '';
  end if;
end
$$;

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
      and conname = 'sync_runs_provider_source_key_check'
  ) then
    alter table public.sync_runs
      add constraint sync_runs_provider_source_key_check
      check (
        btrim(provider) <> ''
        and provider = btrim(provider)
        and btrim(source_key) <> ''
        and source_key = btrim(source_key)
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
