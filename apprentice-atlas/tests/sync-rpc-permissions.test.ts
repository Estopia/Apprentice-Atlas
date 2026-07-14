import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260714100000_atomic_job_source_sync.sql', 'utf8');
const expirationMigration = readFileSync('supabase/migrations/20260714110000_atomic_stale_expiration.sql', 'utf8');
const qaMigration = readFileSync('supabase/migrations/20260714130000_job_ai_qa_sessions.sql', 'utf8');
const favoritesMigration = readFileSync('supabase/migrations/20260714140000_add_favorite_rpc.sql', 'utf8');
const functionSignature = 'public.upsert_job_source(text, text, text, jsonb, jsonb, timestamptz)';

describe('atomic sync RPC permissions', () => {
  it('derives favorite ownership from auth.uid and exposes the add RPC only to authenticated users', () => {
    expect(favoritesMigration).toMatch(/create or replace function public\.add_favorite\(p_job_id uuid\)/i);
    expect(favoritesMigration).toMatch(/security definer\s+set search_path = public/i);
    expect(favoritesMigration).toContain('auth.uid()');
    expect(favoritesMigration).toContain("status = 'active'");
    expect(favoritesMigration).toMatch(/expires_at\s+is null\s+or\s+expires_at\s*>\s*now\(\)/i);
    expect(favoritesMigration).toContain('revoke execute on function public.add_favorite(uuid) from public;');
    expect(favoritesMigration).toContain('revoke execute on function public.add_favorite(uuid) from anon;');
    expect(favoritesMigration).toContain('grant execute on function public.add_favorite(uuid) to authenticated;');
    expect(favoritesMigration).toContain('revoke insert on public.favorites from authenticated;');
    expect(favoritesMigration).not.toMatch(/insert into public\.favorites\s*\([^)]*user_id[^)]*\)\s*select/i);
  });

  it('revokes client execution and grants only service_role execution', () => {
    expect(migration).toContain(`revoke execute on function ${functionSignature} from public;`);
    expect(migration).toContain(`revoke execute on function ${functionSignature} from anon;`);
    expect(migration).toContain(`revoke execute on function ${functionSignature} from authenticated;`);
    expect(migration).toContain(`grant execute on function ${functionSignature} to service_role;`);
    expect(migration.indexOf('revoke execute')).toBeLessThan(migration.indexOf('grant execute'));
  });

  it('preserves the SECURITY DEFINER search-path boundary and runtime assertion', () => {
    expect(migration).toMatch(/security definer\s+set search_path = public/i);
    expect(migration).toContain('grantee = 0 and privilege_type = \'EXECUTE\'');
    expect(migration).toContain("has_function_privilege('anon'");
    expect(migration).toContain("has_function_privilege('authenticated'");
    expect(migration).toContain("has_function_privilege('service_role'");
  });

  it('locks the stale expiration RPC to service_role and keeps it transactional', () => {
    expect(expirationMigration).toMatch(/create or replace function public\.expire_stale_source_jobs/i);
    expect(expirationMigration).toMatch(/security definer\s+set search_path = public/i);
    expect(expirationMigration).toContain('revoke execute on function public.expire_stale_source_jobs(text, timestamptz) from public;');
    expect(expirationMigration).toContain('revoke execute on function public.expire_stale_source_jobs(text, timestamptz) from anon;');
    expect(expirationMigration).toContain('revoke execute on function public.expire_stale_source_jobs(text, timestamptz) from authenticated;');
    expect(expirationMigration).toContain('grant execute on function public.expire_stale_source_jobs(text, timestamptz) to service_role;');
    expect(expirationMigration).toContain('update public.job_sources');
    expect(expirationMigration).toContain('update public.jobs as jobs');
    expect(expirationMigration).toContain('get diagnostics expired_count = row_count;');
    expect(expirationMigration.indexOf('update public.job_sources')).toBeLessThan(expirationMigration.indexOf('update public.jobs as jobs'));
    expect(expirationMigration).not.toMatch(/with\s+stale_sources\s+as\s*\(\s*update/i);
    expect(expirationMigration).toContain("has_function_privilege('service_role'");
  });

  it('locks the QA session counter table and RPC to service_role', () => {
    const signature = 'public.consume_job_ai_question(uuid, uuid)';
    expect(qaMigration).toContain('revoke all on public.job_ai_qa_sessions from public, anon, authenticated;');
    expect(qaMigration).toContain('grant select, insert, update on public.job_ai_qa_sessions to service_role;');
    expect(qaMigration).toContain(`revoke execute on function ${signature} from public, anon, authenticated;`);
    expect(qaMigration).toContain(`grant execute on function ${signature} to service_role;`);
    expect(qaMigration).toMatch(/on conflict \(job_id, session_id\) do update/i);
    expect(qaMigration).toContain('question_count < 2');
    expect(qaMigration).toContain('public.release_job_ai_question(uuid, uuid)');
    expect(qaMigration).toContain('revoke execute on function public.release_job_ai_question(uuid, uuid) from public, anon, authenticated;');
    expect(qaMigration).toContain('grant execute on function public.release_job_ai_question(uuid, uuid) to service_role;');
  });
});
