import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260714190000_application_tracker.sql';
const hardeningMigrationPath = 'supabase/migrations/20260714191000_harden_application_privileges.sql';
const ciWorkflowPath = '../.github/workflows/test.yml';

function migration(): string {
  return readFileSync(migrationPath, 'utf8');
}

describe('application tracker schema and permissions', () => {
  it('creates the constrained applications table and update trigger', () => {
    const sql = migration();
    expect(sql).toMatch(/create table public\.applications\s*\([\s\S]*id uuid primary key default gen_random_uuid\(\)/i);
    expect(sql).toMatch(/user_id uuid not null references auth\.users\(id\) on delete cascade/i);
    expect(sql).toMatch(/job_id uuid not null references public\.jobs\(id\) on delete cascade/i);
    expect(sql).toMatch(/status text not null default 'interested'/i);
    expect(sql).toMatch(/check\s*\(status in \('interested', 'preparing', 'applied', 'interview', 'offer', 'closed'\)\)/i);
    expect(sql).toMatch(/note text[\s\S]*check\s*\(char_length\(note\) <= 500\)/i);
    expect(sql).not.toMatch(/\bnullable\b/i);
    expect(sql).toMatch(/created_at timestamptz not null default now\(\)/i);
    expect(sql).toMatch(/updated_at timestamptz not null default now\(\)/i);
    expect(sql).toMatch(/unique\s*\(user_id,\s*job_id\)/i);
    expect(sql).toMatch(/create trigger applications_set_updated_at[\s\S]*before update on public\.applications[\s\S]*execute function public\.set_updated_at\(\)/i);
  });

  it('adds useful user-status, list-order, and job indexes and enables RLS', () => {
    const sql = migration();
    expect(sql).toMatch(/create index applications_user_status_idx on public\.applications\s*\(user_id,\s*status\)/i);
    expect(sql).toMatch(/create index applications_user_updated_at_idx on public\.applications\s*\(user_id,\s*updated_at desc\)/i);
    expect(sql).toMatch(/create index applications_job_id_idx on public\.applications\s*\(job_id\)/i);
    expect(sql).toContain('alter table public.applications enable row level security;');
  });

  it('defines explicit owner-only policies for every authenticated operation', () => {
    const sql = migration();
    expect(sql).toMatch(/create policy [^\n]+[\s\S]*?on public\.applications for select\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\);/i);
    expect(sql).toMatch(/create policy [^\n]+[\s\S]*?on public\.applications for insert\s+to authenticated\s+with check \(\(select auth\.uid\(\)\) = user_id\);/i);
    expect(sql).toMatch(/create policy [^\n]+[\s\S]*?on public\.applications for update\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)\s+with check \(\(select auth\.uid\(\)\) = user_id\);/i);
    expect(sql).toMatch(/create policy [^\n]+[\s\S]*?on public\.applications for delete\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\);/i);
    expect(sql.match(/create policy/gi)).toHaveLength(4);
  });

  it('routes inserts through an authenticated RPC without anonymous access', () => {
    const sql = migration();
    expect(sql).toContain('revoke all on public.applications from authenticated;');
    expect(sql).toContain('grant select, delete on public.applications to authenticated;');
    expect(sql).toContain('grant update (status, note) on public.applications to authenticated;');
    expect(sql).not.toMatch(/grant update\s+on public\.applications to authenticated/i);
    expect(sql).toContain('revoke insert on public.applications from authenticated;');
    expect(sql).toContain('grant all on public.applications to service_role;');
    expect(sql).toContain('revoke all on public.applications from anon;');
    expect(sql).not.toMatch(/grant\s+[^;]+on public\.applications to (anon|public)/i);
  });

  it('ships a corrective migration for environments with Supabase default table grants', () => {
    const sql = readFileSync(hardeningMigrationPath, 'utf8');
    expect(sql).toContain('revoke all on public.applications from authenticated;');
    expect(sql).toContain('grant select, delete on public.applications to authenticated;');
    expect(sql).toContain('grant update (status, note) on public.applications to authenticated;');
    expect(sql).not.toMatch(/grant update\s+on public\.applications to authenticated/i);
    expect(sql).not.toMatch(/grant (?:insert|truncate|trigger|references)[^;]*to authenticated/i);
  });

  it('defines a session-owned RPC that rejects unavailable jobs for new rows', () => {
    const sql = migration();
    expect(sql).toMatch(/create or replace function public\.upsert_application\(p_job_id uuid, p_status text, p_note text\)/i);
    expect(sql).toMatch(/security definer\s+set search_path = public/i);
    expect(sql).toMatch(/caller_id uuid := auth\.uid\(\)/i);
    expect(sql).toMatch(/where user_id = caller_id\s+and job_id = p_job_id/i);
    expect(sql).toMatch(/jobs\.status = 'active'\s+and \(jobs\.expires_at is null or jobs\.expires_at > now\(\)\)/i);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
    expect(sql).toContain('revoke execute on function public.upsert_application(uuid, text, text) from anon;');
    expect(sql).toContain('grant execute on function public.upsert_application(uuid, text, text) to authenticated;');
  });

  it('does not introduce broad or ownership-free application policies', () => {
    const sql = migration();
    expect(sql).not.toMatch(/on public\.applications for all/i);
    expect(sql).not.toMatch(/on public\.applications[\s\S]*?\bto\s+(anon|public)\b/i);
    expect(sql).not.toMatch(/(?:using|with check)\s*\(\s*(?:true|1\s*=\s*1)\s*\)/i);
  });

  it('gives PostgreSQL integration tests a session-aware auth.uid mock', () => {
    const workflow = readFileSync(ciWorkflowPath, 'utf8');
    const integrationTest = readFileSync('tests/application-rpc.integration.test.ts', 'utf8');
    expect(workflow.match(/current_setting\('request\.jwt\.claim\.sub', true\)/g)).toHaveLength(2);
    expect(workflow).not.toMatch(/CREATE FUNCTION auth\.uid\(\) RETURNS uuid\s+LANGUAGE sql STABLE AS \$\$ SELECT null::uuid \$\$/i);
    expect(workflow).toContain('CREATE TABLE auth.users (id uuid primary key);');
    expect(workflow.match(/CREATE TABLE storage\.buckets/g)).toHaveLength(2);
    expect(workflow.match(/CREATE TABLE storage\.objects/g)).toHaveLength(2);
    expect(integrationTest).toMatch(/insert into auth\.users \(id\)/i);
    expect(integrationTest).not.toMatch(/insert into auth\.users \([^)]*instance_id/i);
  });
});
