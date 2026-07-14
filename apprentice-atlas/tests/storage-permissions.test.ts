import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260714170000_user_assets_storage.sql', 'utf8');

describe('user assets storage permissions', () => {
  it('creates a private bucket with owner-scoped authenticated policies', () => {
    expect(migration).toMatch(/insert into storage\.buckets \(id, name, public\)[\s\S]+values \('user-assets', 'user-assets', false\)/i);
    expect(migration).toMatch(/on storage\.objects[\s\S]+for insert[\s\S]+to authenticated[\s\S]+bucket_id = 'user-assets'[\s\S]+owner_id = \(select auth\.uid\(\)::text\)/i);
    expect(migration).toMatch(/on storage\.objects[\s\S]+for select[\s\S]+to authenticated[\s\S]+bucket_id = 'user-assets'[\s\S]+owner_id = \(select auth\.uid\(\)::text\)/i);
    expect(migration).toMatch(/on storage\.objects[\s\S]+for update[\s\S]+to authenticated[\s\S]+using[\s\S]+owner_id = \(select auth\.uid\(\)::text\)[\s\S]+with check[\s\S]+owner_id = \(select auth\.uid\(\)::text\)/i);
    expect(migration).toMatch(/on storage\.objects[\s\S]+for delete[\s\S]+to authenticated[\s\S]+owner_id = \(select auth\.uid\(\)::text\)/i);
    expect(migration).not.toMatch(/for select\s+to\s+(public|anon)/i);
  });
});
