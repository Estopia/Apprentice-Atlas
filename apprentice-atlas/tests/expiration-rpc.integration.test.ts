import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.TASK3_TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
let hasPsql = true;
try {
  execFileSync('psql', ['--version'], { stdio: 'ignore' });
} catch {
  hasPsql = false;
}

const testSql = `
begin;
insert into public.jobs (id, title, company, country, city, job_type, level, category, raw_description, requirements, source_url, source_name, status, last_seen_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', 'Stale only', 'Atlas', 'GB', 'Nationwide', 'apprenticeship', 'entry-level', 'general', '', '{}', 'https://example.test/stale', 'find-apprenticeship', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000002', 'Fresh source', 'Atlas', 'GB', 'London', 'apprenticeship', 'entry-level', 'general', '', '{}', 'https://example.test/fresh', 'find-apprenticeship', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
insert into public.job_sources (job_id, provider, external_id, source_url, raw_payload, status, fetched_at)
values
  ('00000000-0000-0000-0000-000000000001', 'find-apprenticeship', 'stale-only', 'https://example.test/stale', '{}', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000002', 'find-apprenticeship', 'stale-part', 'https://example.test/stale-part', '{}', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000002', 'find-apprenticeship', 'fresh-part', 'https://example.test/fresh-part', '{}', 'active', '2026-01-03T00:00:00Z');
select public.expire_stale_source_jobs('find-apprenticeship', '2026-01-02T00:00:00Z');
select json_build_object(
  'stale_job_status', (select status from public.jobs where id = '00000000-0000-0000-0000-000000000001'),
  'fresh_job_status', (select status from public.jobs where id = '00000000-0000-0000-0000-000000000002'),
  'stale_source_status', (select status from public.job_sources where external_id = 'stale-only'),
  'fresh_source_status', (select status from public.job_sources where external_id = 'fresh-part')
)::text;
rollback;
`;

describe('expire_stale_source_jobs PostgreSQL integration', () => {
  it.skipIf(!databaseUrl || !hasPsql)('expires only jobs whose sources are all stale', () => {
    const output = execFileSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', databaseUrl!], { input: testSql, encoding: 'utf8' }).trim().split('\n');
    expect(Number(output[0])).toBe(1);
    expect(JSON.parse(output[1])).toEqual({
      stale_job_status: 'expired',
      fresh_job_status: 'active',
      stale_source_status: 'retired',
      fresh_source_status: 'active',
    });
  });
});
