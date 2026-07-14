import { execFileSync, spawn } from 'node:child_process';
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
  ('00000000-0000-0000-0000-000000000002', 'Fresh source', 'Atlas', 'GB', 'London', 'apprenticeship', 'entry-level', 'general', '', '{}', 'https://example.test/fresh', 'find-apprenticeship', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000003', 'Cross provider', 'Atlas', 'GB', 'Manchester', 'apprenticeship', 'entry-level', 'general', '', '{}', 'https://example.test/cross', 'find-apprenticeship', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
insert into public.job_sources (job_id, provider, external_id, source_url, raw_payload, status, fetched_at)
values
  ('00000000-0000-0000-0000-000000000001', 'find-apprenticeship', 'stale-only', 'https://example.test/stale', '{}', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000002', 'find-apprenticeship', 'stale-part', 'https://example.test/stale-part', '{}', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000002', 'find-apprenticeship', 'fresh-part', 'https://example.test/fresh-part', '{}', 'active', '2026-01-03T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000003', 'find-apprenticeship', 'cross-stale', 'https://example.test/cross-stale', '{}', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000003', 'other-provider', 'cross-fresh', 'https://example.test/cross-fresh', '{}', 'active', '2026-01-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000003', 'find-apprenticeship', 'already-retired', 'https://example.test/already-retired', '{}', 'retired', '2026-01-01T00:00:00Z'),
  (null, 'find-apprenticeship', 'null-job', 'https://example.test/null-job', '{}', 'active', '2026-01-01T00:00:00Z');
select public.expire_stale_source_jobs('find-apprenticeship', '2026-01-02T00:00:00Z');
select json_build_object(
  'stale_job_status', (select status from public.jobs where id = '00000000-0000-0000-0000-000000000001'),
  'fresh_job_status', (select status from public.jobs where id = '00000000-0000-0000-0000-000000000002'),
  'cross_job_status', (select status from public.jobs where id = '00000000-0000-0000-0000-000000000003'),
  'stale_source_status', (select status from public.job_sources where external_id = 'stale-only'),
  'fresh_source_status', (select status from public.job_sources where external_id = 'fresh-part'),
  'cross_fresh_source_status', (select status from public.job_sources where external_id = 'cross-fresh'),
  'retired_source_status', (select status from public.job_sources where external_id = 'already-retired'),
  'null_job_source_status', (select status from public.job_sources where external_id = 'null-job')
)::text;
rollback;
`;

function runPsql(sql: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', databaseUrl!]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr || `psql exited with ${code}`)));
    child.stdin.end(sql);
  });
}

describe('expire_stale_source_jobs PostgreSQL integration', () => {
  it.skipIf(!databaseUrl || !hasPsql)('expires only jobs whose sources are all stale', () => {
    const output = execFileSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', databaseUrl!], { input: testSql, encoding: 'utf8' }).trim().split('\n');
    expect(Number(output[0])).toBe(1);
    expect(JSON.parse(output[1])).toEqual({
      stale_job_status: 'expired',
      fresh_job_status: 'active',
      cross_job_status: 'active',
      stale_source_status: 'retired',
      fresh_source_status: 'active',
      cross_fresh_source_status: 'active',
      retired_source_status: 'retired',
      null_job_source_status: 'retired',
    });
  });

  it.skipIf(!databaseUrl || !hasPsql)('serializes concurrent expiration calls without double-counting', async () => {
    const setupSql = `
      begin;
      insert into public.jobs (id, title, company, country, city, job_type, level, category, raw_description, requirements, source_url, source_name, status, last_seen_at, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000101', 'Concurrent stale', 'Atlas', 'GB', 'Nationwide', 'apprenticeship', 'entry-level', 'general', '', '{}', 'https://example.test/concurrent', 'find-apprenticeship', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
      insert into public.job_sources (job_id, provider, external_id, source_url, raw_payload, status, fetched_at)
      values ('00000000-0000-0000-0000-000000000101', 'find-apprenticeship', 'concurrent-stale', 'https://example.test/concurrent', '{}', 'active', '2026-01-01T00:00:00Z');
      commit;
    `;
    execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', databaseUrl!], { input: setupSql, encoding: 'utf8' });
    try {
      const results = await Promise.all([
        runPsql("select public.expire_stale_source_jobs('find-apprenticeship', '2026-01-02T00:00:00Z');"),
        runPsql("select public.expire_stale_source_jobs('find-apprenticeship', '2026-01-02T00:00:00Z');"),
      ]);
      expect(results.map(Number).sort()).toEqual([0, 1]);
      expect(execFileSync('psql', ['-X', '-q', '-At', databaseUrl!], { input: "select status from public.jobs where id = '00000000-0000-0000-0000-000000000101';", encoding: 'utf8' }).trim()).toBe('expired');
    } finally {
      execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', databaseUrl!], { input: "delete from public.job_sources where external_id = 'concurrent-stale'; delete from public.jobs where id = '00000000-0000-0000-0000-000000000101';", encoding: 'utf8' });
    }
  });
});
