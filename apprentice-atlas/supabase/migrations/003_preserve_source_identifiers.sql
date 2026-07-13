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
  -- Never overwrite an existing audit value, including on reruns or manual
  -- updates that include the metadata column.
  if old.legacy_external_id is not null
     and new.legacy_external_id is distinct from old.legacy_external_id then
    new.legacy_external_id := old.legacy_external_id;
  end if;

  -- Capture the pre-change value before any future repair changes external_id.
  if old.legacy_external_id is null
     and new.external_id is distinct from old.external_id then
    new.legacy_external_id := old.external_id;
  end if;

  return new;
end;
$$;

drop trigger if exists job_sources_preserve_legacy_external_id
  on public.job_sources;

create trigger job_sources_preserve_legacy_external_id
before update of external_id, legacy_external_id on public.job_sources
for each row execute function public.preserve_legacy_external_id();
