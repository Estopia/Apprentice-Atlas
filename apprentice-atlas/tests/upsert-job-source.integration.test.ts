import { execFileSync, spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.TASK3_TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
let hasPsql = true;
try {
  execFileSync('psql', ['--version'], { stdio: 'ignore' });
} catch {
  hasPsql = false;
}

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

function upsertSql(jobId: string, sourceUrl: string, createdAt: string, externalId = 'concurrent-rpc') {
  return `select job_id, inserted from public.upsert_job_source(
    'find-apprenticeship', '${externalId}', '${sourceUrl}', '{}'::jsonb,
    jsonb_build_object(
      'id', '${jobId}', 'title', 'RPC apprentice', 'company', 'Atlas', 'country', 'GB', 'city', 'Nationwide',
      'latitude', null, 'longitude', null, 'job_type', 'apprenticeship', 'level', 'entry-level', 'category', 'general',
      'tags', '[]'::jsonb, 'raw_description', '', 'requirements', '[]'::jsonb, 'source_url', '${sourceUrl}',
      'source_name', 'find-apprenticeship', 'status', 'active', 'last_seen_at', '${createdAt}',
      'expires_at', null, 'created_at', '${createdAt}', 'updated_at', '${createdAt}'
    ), '${createdAt}'::timestamptz
  );`;
}

describe('upsert_job_source PostgreSQL integration', () => {
  it.skipIf(!databaseUrl || !hasPsql)('serializes concurrent claims to one job/source and preserves created_at', async () => {
    const firstJobId = '00000000-0000-0000-0000-000000000201';
    const secondJobId = '00000000-0000-0000-0000-000000000202';
    const sourceUrl = 'https://example.test/concurrent-rpc';
    execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', databaseUrl!], { input: `delete from public.job_sources where external_id = 'concurrent-rpc'; delete from public.jobs where id in ('${firstJobId}', '${secondJobId}');`, encoding: 'utf8' });
    try {
      const claims = await Promise.all([
        runPsql(upsertSql(firstJobId, sourceUrl, '2026-02-01T00:00:00Z')),
        runPsql(upsertSql(secondJobId, sourceUrl, '2026-02-02T00:00:00Z')),
      ]);
      expect(claims.map((claim) => claim.split('|')[1]).sort()).toEqual(['f', 't']);
      const state = JSON.parse(execFileSync('psql', ['-X', '-q', '-At', databaseUrl!], {
        input: "select json_build_object('job_count', (select count(*) from public.jobs where id in ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000202')), 'source_count', (select count(*) from public.job_sources where provider = 'find-apprenticeship' and external_id = 'concurrent-rpc'), 'job_id', (select job_id from public.job_sources where external_id = 'concurrent-rpc'), 'created_at', (select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') from public.jobs where id = (select job_id from public.job_sources where external_id = 'concurrent-rpc')))::text;",
        encoding: 'utf8',
      }).trim());
      expect(state.job_count).toBe(1);
      expect(state.source_count).toBe(1);
      expect([firstJobId, secondJobId]).toContain(state.job_id);
      expect(['2026-02-01T00:00:00Z', '2026-02-02T00:00:00Z']).toContain(state.created_at);
      const originalCreatedAt = state.created_at;
      await runPsql(upsertSql('00000000-0000-0000-0000-000000000203', sourceUrl, '2030-01-01T00:00:00Z'));
      const repeatedCreatedAt = execFileSync('psql', ['-X', '-q', '-At', databaseUrl!], { input: "select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') from public.jobs where id = (select job_id from public.job_sources where external_id = 'concurrent-rpc');", encoding: 'utf8' }).trim();
      expect(repeatedCreatedAt).toBe(originalCreatedAt);
    } finally {
      execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', databaseUrl!], { input: `delete from public.job_sources where external_id = 'concurrent-rpc'; delete from public.jobs where id in ('${firstJobId}', '${secondJobId}', '00000000-0000-0000-0000-000000000203');`, encoding: 'utf8' });
    }
  });

  it.skipIf(!databaseUrl || !hasPsql)('rolls back invalid payloads without partial source/job rows', async () => {
    const invalidJobId = '00000000-0000-0000-0000-000000000299';
    execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', databaseUrl!], { input: "delete from public.job_sources where external_id = 'invalid-rpc'; delete from public.jobs where id = '00000000-0000-0000-0000-000000000299';", encoding: 'utf8' });
    await expect(runPsql(`select * from public.upsert_job_source(
      'find-apprenticeship', 'invalid-rpc', 'https://example.test/invalid-rpc', '{}'::jsonb,
      jsonb_build_object('id', '${invalidJobId}', 'company', 'Atlas', 'country', 'GB', 'city', 'Nationwide', 'job_type', 'apprenticeship', 'level', 'entry-level', 'category', 'general', 'tags', '[]'::jsonb, 'raw_description', '', 'requirements', '[]'::jsonb, 'source_url', 'https://example.test/invalid-rpc', 'source_name', 'find-apprenticeship', 'status', 'active'),
      '2026-02-01T00:00:00Z'
    );`)).rejects.toThrow();
    expect(execFileSync('psql', ['-X', '-q', '-At', databaseUrl!], { input: "select count(*) from public.job_sources where external_id = 'invalid-rpc';", encoding: 'utf8' }).trim()).toBe('0');
    expect(execFileSync('psql', ['-X', '-q', '-At', databaseUrl!], { input: `select count(*) from public.jobs where id = '${invalidJobId}';`, encoding: 'utf8' }).trim()).toBe('0');
  });
});
