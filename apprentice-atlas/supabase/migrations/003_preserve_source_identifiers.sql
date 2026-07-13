-- Complete post-baseline schema hardening and source audit protection.
-- This migration is intentionally after 002 so legacy source metadata can be
-- normalized without making the released baseline migration fail.

alter table public.job_sources
  add column if not exists legacy_external_id text;

-- Older intermediate variants may already have installed these constraints.
-- Remove them before normalizing values and recreate them below.
alter table public.job_sources
  drop constraint if exists job_sources_provider_external_id_check;

alter table public.job_sources
  drop constraint if exists job_sources_provider_external_id_key;

-- Normalize providers first; this makes provider/external-ID grouping stable.
update public.job_sources
set provider = case
  when provider is null or btrim(provider) = '' then 'legacy-source-' || id::text
  else btrim(provider)
end;

-- Trim external IDs, repair blanks, and resolve normalized collisions in
-- deterministic ID order. The first row keeps the normalized value; every
-- changed value preserves its raw predecessor once in legacy_external_id.
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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
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

comment on column public.job_sources.legacy_external_id is
  'Original external_id captured before a later normalization or duplicate repair; immutable once populated.';

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
