-- Preserve source identifiers for all repairs performed after 002.
-- This migration cannot recover identifiers that an older 002 already rewrote.

alter table public.job_sources
  add column if not exists legacy_external_id text;

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

  -- Existing audit values are immutable and caller-supplied values are never
  -- accepted. Only the trigger may populate the field below.
  if old.legacy_external_id is not null then
    if new.legacy_external_id is distinct from old.legacy_external_id then
      raise exception 'legacy_external_id is immutable once populated'
        using errcode = 'check_violation';
    end if;
  elsif new.legacy_external_id is not null then
    raise exception 'legacy_external_id is server-managed and cannot be provided on UPDATE'
      using errcode = 'check_violation';
  elsif new.external_id is distinct from old.external_id then
    -- Capture the pre-change value before any future repair changes external_id.
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
