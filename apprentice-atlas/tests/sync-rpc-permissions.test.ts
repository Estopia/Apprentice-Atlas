import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260714100000_atomic_job_source_sync.sql', 'utf8');
const functionSignature = 'public.upsert_job_source(text, text, text, jsonb, jsonb, timestamptz)';

describe('atomic sync RPC permissions', () => {
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
});
