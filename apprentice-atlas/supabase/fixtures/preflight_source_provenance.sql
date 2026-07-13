-- LOCAL VALIDATION FIXTURE ONLY.
-- Run after 20260713090000_initial_schema.sql and before
-- 20260713091000_preflight_source_cleanup.sql. It simulates an intermediate
-- import that already has source_key/source_provider columns.

insert into public.jobs (
  id, title, company, country, city, latitude, longitude, job_type, level,
  category, tags, raw_description, requirements, source_url, source_name
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'LOCAL FIXTURE: provenance preflight test', 'Fixture Employer',
  'Germany', 'Berlin', 52.5200, 13.4050, 'apprenticeship', 'entry',
  'technology', array['fixture'], 'LOCAL FIXTURE ONLY', array['Fixture'],
  'https://example.test/preflight-fixture', 'Local Preflight Fixture'
)
on conflict (id) do nothing;

alter table public.sync_runs
  add column if not exists source_key text;

alter table public.sync_runs
  add column if not exists source_provider text;

alter table public.job_sources
  drop constraint if exists job_sources_provider_external_id_key;

insert into public.job_sources (
  id, job_id, provider, external_id, source_url
) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ' provider-b ', 'canonical-id', 'https://example.test/source-1'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'provider-b', ' canonical-id ', 'https://example.test/source-2'
  )
on conflict (id) do nothing;

insert into public.sync_runs (
  id, provider, source_id, source_key, status
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  ' sync-provider ',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'malformed non-null legacy key',
  'succeeded'
)
on conflict (id) do nothing;

-- After preflight, this run must retain source_provider = provider-b and use
-- sync-provider:legacy-duplicate-<source-id>, never a legacy-preflight key.
