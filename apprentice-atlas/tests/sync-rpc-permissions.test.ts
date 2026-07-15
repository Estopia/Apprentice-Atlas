import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260714100000_atomic_job_source_sync.sql', 'utf8');
const expirationMigration = readFileSync('supabase/migrations/20260714110000_atomic_stale_expiration.sql', 'utf8');
const qaMigration = readFileSync('supabase/migrations/20260714130000_job_ai_qa_sessions.sql', 'utf8');
const prepareQuotaMigration = readFileSync('supabase/migrations/20260715150000_ai_prepare_quota.sql', 'utf8');
const favoritesMigration = readFileSync('supabase/migrations/20260714140000_add_favorite_rpc.sql', 'utf8');
const sourceUrlMigration = readFileSync('supabase/migrations/20260714150000_enforce_source_listing_urls.sql', 'utf8');
const applicationUrlMigration = readFileSync('supabase/migrations/20260714160000_enforce_application_urls.sql', 'utf8');
const functionSignature = 'public.upsert_job_source(text, text, text, jsonb, jsonb, timestamptz)';

describe('atomic sync RPC permissions', () => {
  it('enforces source URLs for new writes without invalidating legacy rows', () => {
    expect(sourceUrlMigration).toMatch(/jobs_source_url_http_check[\s\S]+not valid/i);
    expect(sourceUrlMigration).toMatch(/job_sources_source_url_http_check[\s\S]+not valid/i);
    expect(sourceUrlMigration).toMatch(/requires a valid http or https source URL/i);
    expect(sourceUrlMigration).toMatch(/job\.source_url to be a valid http or https URL/i);
    expect(sourceUrlMigration).not.toMatch(/application_url[^\n]+source_url/i);
  });
  it('enforces optional strict application URLs without coupling them to source URLs', () => {
    expect(applicationUrlMigration).toMatch(/jobs_application_url_http_check[\s\S]+not valid/i);
    expect(applicationUrlMigration).toMatch(/application_url is null[\s\S]+https\?:\/\//i);
    expect(applicationUrlMigration).not.toMatch(/source_url/i);
  });
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

  it('keeps AI preparation quota state private and exposes only atomic service-role RPCs', () => {
    expect(prepareQuotaMigration).toContain('create schema if not exists private;');
    expect(prepareQuotaMigration).toMatch(/create table private\.ai_prepare_usage/i);
    expect(prepareQuotaMigration).toContain('ai_prepare_hourly_quota constant integer := 5;');
    expect(prepareQuotaMigration).toMatch(/insert into private\.ai_prepare_usage[\s\S]+on conflict \(user_id, window_started_at\) do update[\s\S]+usage_count < ai_prepare_hourly_quota/i);
    expect(prepareQuotaMigration).toMatch(/create or replace function public\.reserve_ai_prepare_quota\(p_user_id uuid\)[\s\S]+security definer[\s\S]+set search_path = pg_catalog/i);
    expect(prepareQuotaMigration).toMatch(/create or replace function public\.release_ai_prepare_quota\(p_user_id uuid, p_window_started_at timestamptz\)[\s\S]+security definer[\s\S]+set search_path = pg_catalog/i);
    expect(prepareQuotaMigration).toContain('revoke all on private.ai_prepare_usage from public, anon, authenticated, service_role;');
    expect(prepareQuotaMigration).toContain('revoke execute on function public.reserve_ai_prepare_quota(uuid) from public, anon, authenticated;');
    expect(prepareQuotaMigration).toContain('grant execute on function public.reserve_ai_prepare_quota(uuid) to service_role;');
    expect(prepareQuotaMigration).toContain('revoke execute on function public.release_ai_prepare_quota(uuid, timestamptz) from public, anon, authenticated;');
    expect(prepareQuotaMigration).toContain('grant execute on function public.release_ai_prepare_quota(uuid, timestamptz) to service_role;');
    expect(prepareQuotaMigration).toContain("has_function_privilege('anon', 'public.reserve_ai_prepare_quota(uuid)', 'EXECUTE')");
    expect(prepareQuotaMigration).toContain("has_function_privilege('authenticated', 'public.release_ai_prepare_quota(uuid,timestamptz)', 'EXECUTE')");
    expect(prepareQuotaMigration).toContain("has_function_privilege('service_role', 'public.reserve_ai_prepare_quota(uuid)', 'EXECUTE')");
  });
});
