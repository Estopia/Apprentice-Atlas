-- Preflight cleanup for legacy imports.
-- This migration runs after 20260713090000_initial_schema.sql and before the
-- locked 20260713092000_harden_schema_integrity.sql
-- baseline. It is harmless on clean data and makes older source metadata safe
-- for 002's exact integrity checks.

alter table public.job_sources
  add column if not exists legacy_external_id text;

-- Older intermediate schemas may already have these constraints. Remove the
-- source uniqueness constraint while normalized collisions are repaired.
alter table public.job_sources
  drop constraint if exists job_sources_provider_external_id_key;

drop index if exists public.job_sources_provider_external_id_key;

-- Keep listing-provider provenance available to the locked 002 backfill even
-- when an intermediate schema has not added it yet.
alter table public.sync_runs
  add column if not exists source_provider text;

update public.job_sources
set provider = case
  when provider is null or btrim(provider) = '' then 'legacy-source-' || id::text
  else btrim(provider)
end;

-- Keep the lowest UUID deterministically. Rows whose normalized identifier is
-- already owned by a lower UUID receive a stable duplicate identifier, while
-- the original raw external ID is retained exactly once in the audit column.
do $$
declare
  source_row record;
  candidate text;
  normalized_external_id text;
  duplicate_suffix integer;
begin
  for source_row in
    select id, provider, external_id
    from public.job_sources
    order by id
  loop
    normalized_external_id := btrim(coalesce(source_row.external_id, ''));
    candidate := case
      when normalized_external_id = '' then 'legacy-source-' || source_row.id::text
      else normalized_external_id
    end;

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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_sources'::regclass
      and conname = 'job_sources_provider_external_id_key'
  ) then
    alter table public.job_sources
      add constraint job_sources_provider_external_id_key
      unique (provider, external_id);
  end if;
end
$$;

-- Existing intermediate schemas may have source-key columns already. Prepare
-- them for 002 without assuming those columns exist on a fresh 001 schema.
do $$
declare
  has_source_key boolean;
  has_source_id boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sync_runs'
      and column_name = 'source_key'
  ) into has_source_key;

  if has_source_key then
    alter table public.sync_runs
      add column if not exists legacy_source_key text;

    alter table public.sync_runs
      drop constraint if exists sync_runs_source_provider_check;
    alter table public.sync_runs
      drop constraint if exists sync_runs_provider_source_key_check;
    alter table public.sync_runs
      drop constraint if exists sync_runs_check;

    update public.sync_runs
    set provider = case
      when btrim(provider) = '' then 'legacy-run-' || id::text
      else btrim(provider)
    end;

    update public.sync_runs as runs
    set legacy_source_key = runs.source_key
    where btrim(runs.source_key) <> ''
      and (
        runs.source_key <> btrim(runs.source_key)
        or left(runs.source_key, length(runs.provider) + 1) <> runs.provider || ':'
        or length(runs.source_key) <= length(runs.provider) + 1
      )
      and (runs.legacy_source_key is null or btrim(runs.legacy_source_key) = '');

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'sync_runs'
        and column_name = 'source_id'
    ) into has_source_id;

    if has_source_id then
      -- Preserve a provider mismatch: source_provider describes the joined
      -- listing, while provider remains the sync adapter and source-key prefix.
      update public.sync_runs as runs
      set source_provider = btrim(sources.provider)
      from public.job_sources as sources
      where runs.source_id = sources.id
        and (runs.source_provider is null or btrim(runs.source_provider) = '');

      -- A joined source is authoritative whenever a legacy source_key is
      -- present, including a NOT NULL malformed key. Derive the canonical key
      -- before considering any fallback so listing provenance is not lost.
      update public.sync_runs as runs
      set source_key = runs.provider || ':' || btrim(sources.external_id)
      from public.job_sources as sources
      where runs.source_id = sources.id
        and runs.source_key is not null;

      -- Null legacy keys are also derived when the old listing still joins.
      update public.sync_runs as runs
      set source_key = runs.provider || ':' || btrim(sources.external_id)
      from public.job_sources as sources
      where runs.source_id = sources.id
        and runs.source_key is null;
    end if;

    update public.sync_runs
    set source_key = provider || ':legacy-preflight-' || id::text
    where source_key is null
       or btrim(source_key) = ''
       or source_key <> btrim(source_key)
       or left(source_key, length(provider) + 1) <> provider || ':'
       or length(source_key) <= length(provider) + 1;
  else
    -- Fresh 001 does not have source_key yet; 002 adds and backfills it.
    update public.sync_runs
    set provider = case
      when btrim(provider) = '' then 'legacy-run-' || id::text
      else btrim(provider)
    end;
  end if;
end
$$;

comment on column public.job_sources.legacy_external_id is
  'Original external_id captured before preflight normalization or collision repair; immutable once populated.';
