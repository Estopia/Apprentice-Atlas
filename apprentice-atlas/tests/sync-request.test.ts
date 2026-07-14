import { describe, expect, it } from 'vitest';
import { parseSyncRequest } from '../supabase/functions/_shared/sync-request';

describe('sync request handler body parsing', () => {
  it('treats an absent body as the default provider request', async () => {
    await expect(parseSyncRequest(new Request('https://example.test', { method: 'POST' }))).resolves.toEqual({ body: {} });
  });

  it('returns INVALID_JSON for malformed JSON instead of defaulting to UK', async () => {
    const parsed = await parseSyncRequest(new Request('https://example.test', { method: 'POST', body: '{not-json' }));
    expect(parsed).toEqual({ error: { code: 'INVALID_JSON', message: expect.any(String) } });
    await expect(parseSyncRequest(new Request('https://example.test', { method: 'POST', body: '   ' }))).resolves.toMatchObject({ error: { code: 'INVALID_JSON' } });
  });

  it('parses a valid provider body', async () => {
    await expect(parseSyncRequest(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ provider: 'find-apprenticeship' }) }))).resolves.toEqual({ body: { provider: 'find-apprenticeship' } });
  });
});
