-- Final post-release hardening after the locked 002 baseline.
-- This migration is deliberately guarded and idempotent so it can finish
-- earlier intermediate schemas as well as a fresh 001 -> locked 002 install.

-- Complete sync provenance columns for intermediate schemas that predate the
-- provider-configuration model. source_id is retained until its backfill is
-- complete, then removed when this migration owns the upgraded schema.
alter table public.sync_runs
  add column if not exists source_key text;

alter table public.sync_runs
  add column if not exists source_provider text;

alter table public.sync_runs
  add column if not exists legacy_source_key text;

alter table public.job_sources
  add column if not exists legacy_external_id text;

alter table public.job_sources
  drop constraint if exists job_sources_provider_external_id_check;

alter table public.job_sources
  drop constraint if exists job_sources_provider_external_id_key;

drop index if exists public.job_sources_provider_external_id_key;

alter table public.sync_runs
  drop constraint if exists sync_runs_source_provider_check;

alter table public.sync_runs
  drop constraint if exists sync_runs_provider_source_key_check;

alter table public.sync_runs
  drop constraint if exists sync_runs_check;

-- Normalize providers before grouping source identifiers. Null/blank legacy
-- providers receive a stable row-specific provider name.
update public.job_sources
set provider = case
  when provider is null or btrim(provider) = '' then 'legacy-source-' || id::text
  else btrim(provider)
end;

-- Normalize identifiers and repair collisions deterministically in ID order.
-- Any changed value is copied once to legacy_external_id before replacement.
do $$
declare
  source_row record;
  normalized_external_id text;
  candidate text;
  duplicate_suffix integer;
begin
  for source_row in
    select id, provider, external_id
    from public.job_sources
    order by id
  loop
    normalized_external_id := btrim(coalesce(source_row.external_id, ''));
    if normalized_external_id = '' then
      candidate := 'legacy-source-' || source_row.id::text;
    else
      candidate := normalized_external_id;
    end if;

    if exists (
      select 1
      from public.job_sources as previous
      where previous.provider = source_row.provider
        and previous.external_id = candidate
        and previous.id < source_row.id
    ) then
      candidate := 'legacy-duplicate-' || source_row.id::text;
      duplicate_suffix := 0;
      while exists (
        select 1
        from public.job_sources as previous
        where previous.provider = source_row.provider
          and previous.external_id = candidate
          and previous.id < source_row.id
      ) loop
        duplicate_suffix := duplicate_suffix + 1;
        candidate := 'legacy-duplicate-' || source_row.id::text || '-' || duplicate_suffix::text;
      end loop;
    end if;

    if source_row.external_id is distinct from candidate then
      update public.job_sources
      set legacy_external_id = source_row.external_id
      where id = source_row.id
        and legacy_external_id is null;
    end if;

    update public.job_sources
    set external_id = candidate
    where id = source_row.id;
  end loop;
end
$$;

comment on column public.job_sources.legacy_external_id is
  'Original external_id captured before a later normalization or duplicate repair; immutable once populated.';

-- Normalize run providers before exact source-key validation.
update public.sync_runs
set provider = case
  when btrim(provider) = '' then 'legacy-run-' || id::text
  else btrim(provider)
end;

-- Preserve listing-provider metadata and derive source keys from the provider
-- that performed the run. source_id is used only to locate the old listing.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sync_runs'
      and column_name = 'source_id'
  ) then
    update public.sync_runs as runs
    set source_provider = btrim(sources.provider)
    from public.job_sources as sources
    where runs.source_id = sources.id
      and (runs.source_provider is null or btrim(runs.source_provider) = '');

    update public.sync_runs as runs
    set source_key = runs.provider || ':' ||
      case
        when btrim(coalesce(sources.external_id, '')) <> '' then btrim(sources.external_id)
        else 'legacy-source-' || sources.id::text
      end
    from public.job_sources as sources
    where runs.source_id = sources.id
      and (runs.source_key is null or btrim(runs.source_key) = '');
  end if;
end
$$;

update public.sync_runs
set source_provider = nullif(btrim(source_provider), '')
where source_provider is not null;

-- Existing malformed keys are retained for audit, then replaced with a
-- deterministic provider-prefixed run fallback. This uses exact prefix
-- comparisons rather than LIKE wildcard matching.
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

alter table public.sync_runs
  drop column if exists source_id;

alter table public.sync_runs
  alter column source_key set not null;

-- Permanent exact source metadata integrity after all normalization and
-- collision repair is complete.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.job_sources'::regclass
      and conname = 'job_sources_provider_external_id_check'
  ) then
    alter table public.job_sources
      add constraint job_sources_provider_external_id_check
      check (
        btrim(provider) = provider
        and btrim(provider) <> ''
        and btrim(external_id) = external_id
        and btrim(external_id) <> ''
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.job_sources'::regclass
      and conname = 'job_sources_provider_external_id_key'
  ) then
    alter table public.job_sources
      add constraint job_sources_provider_external_id_key
      unique (provider, external_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
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
    select 1 from pg_constraint
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

-- Final translation publication invariant, including intermediate schemas that
-- did not yet have the named constraint.
alter table public.job_translations
  drop constraint if exists job_translations_published_at_status_check;

alter table public.job_translations
  add constraint job_translations_published_at_status_check
  check (
    (status = 'published' and published_at is not null)
    or (status in ('draft', 'archived') and published_at is null)
  );

-- Reapply the public visibility boundary so upgrades from older policies are
-- expiration-aware. NULL expires_at remains non-expiring.
alter table public.jobs enable row level security;
alter table public.job_translations enable row level security;

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

-- Install server-managed audit protection last, after this migration has
-- completed its own normalization writes.
create or replace function public.preserve_legacy_external_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.legacy_external_id is not null then
      raise exception 'legacy_external_id is server-managed and cannot be provided on INSERT'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if old.legacy_external_id is not null then
    if new.legacy_external_id is distinct from old.legacy_external_id then
      raise exception 'legacy_external_id is immutable once populated'
        using errcode = 'check_violation';
    end if;
  elsif new.legacy_external_id is not null then
    raise exception 'legacy_external_id is server-managed and cannot be provided on UPDATE'
      using errcode = 'check_violation';
  elsif new.external_id is distinct from old.external_id then
    new.legacy_external_id := old.external_id;
  end if;

  return new;
end;
$$;

drop trigger if exists job_sources_preserve_legacy_external_id
  on public.job_sources;

create trigger job_sources_preserve_legacy_external_id
before insert or update of external_id, legacy_external_id on public.job_sources
for each row execute function public.preserve_legacy_external_id();
