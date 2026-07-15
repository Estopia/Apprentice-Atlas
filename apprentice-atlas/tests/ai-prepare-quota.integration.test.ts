import { execFileSync, spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.TASK3_TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
let hasPsql = true;
try {
  execFileSync('psql', ['--version'], { stdio: 'ignore' });
} catch {
  hasPsql = false;
}

const userId = '30000000-0000-4000-8000-000000000001';

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

describe('AI preparation quota PostgreSQL integration', () => {
  it.skipIf(!databaseUrl || !hasPsql)('atomically caps concurrent hourly reservations and allows a compensated retry', async () => {
    execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', databaseUrl!], {
      input: `insert into auth.users (id) values ('${userId}') on conflict (id) do nothing; delete from private.ai_prepare_usage where user_id = '${userId}';`,
      encoding: 'utf8',
    });
    try {
      const reservations = await Promise.all(Array.from({ length: 6 }, () => runPsql(`select public.reserve_ai_prepare_quota('${userId}');`)));
      const reservedWindows = reservations.filter(Boolean);
      expect(reservations.filter((value) => !value)).toHaveLength(1);
      expect(reservedWindows).toHaveLength(5);
      expect(new Set(reservedWindows).size).toBe(1);
      expect(await runPsql(`select public.release_ai_prepare_quota('${userId}', '${reservedWindows[0]}'::timestamptz);`)).toBe('t');
      expect(await runPsql(`select public.reserve_ai_prepare_quota('${userId}');`)).toBe(reservedWindows[0]);
    } finally {
      execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', databaseUrl!], {
        input: `delete from private.ai_prepare_usage where user_id = '${userId}'; delete from auth.users where id = '${userId}';`,
        encoding: 'utf8',
      });
    }
  });
});
