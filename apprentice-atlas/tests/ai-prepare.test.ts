import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createPrepareHandler, type PrepareAdminClient, type PrepareDeps } from '../supabase/functions/ai-prepare/handler';

const jobId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const background = 'I built a school website, enjoy programming, and work well in a team.';
const canonicalJob = {
  id: jobId,
  title: 'Web apprentice',
  company: 'Atlas',
  country: 'Germany',
  city: 'Berlin',
  job_type: 'apprenticeship',
  level: 'entry',
  category: 'technology',
  tags: ['web'],
  raw_description: 'Learn web development.',
  requirements: ['Interest in programming'],
  status: 'active',
  expires_at: null,
};
const output = {
  interviewQuestions: [
    { question: 'Why this apprenticeship?', whyAsked: 'Checks motivation.', answerTip: 'Connect your interest to the posting.' },
    { question: 'What did you learn from your website?', whyAsked: 'Explores practical learning.', answerTip: 'Give one concrete example.' },
    { question: 'How do you approach teamwork?', whyAsked: 'Relates to your stated background.', answerTip: 'Use a short situation-action-result story.' },
  ],
  skillGap: {
    matches: ['Interest in programming'],
    gaps: ['No professional web experience is stated.'],
    positioningTips: ['Be honest about your level and emphasize how you learn.'],
  },
};

const env = (overrides: Record<string, string> = {}) => (name: string) => ({
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
  OPENAI_API_KEY: 'openai-secret',
  ...overrides,
}[name] ?? '');

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify({ output_text: JSON.stringify(value) }), { status });
}

function adminClient(options: { job?: Record<string, unknown> | null; favorite?: boolean; application?: boolean } = {}) {
  const reads: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const writes: string[] = [];
  const db = {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const chain: any = {
        select: () => chain,
        eq: (column: string, value: unknown) => { filters.push([column, value]); return chain; },
        limit: () => chain,
        maybeSingle: async () => {
          reads.push({ table, filters: [...filters] });
          if (table === 'jobs') return { data: options.job === undefined ? canonicalJob : options.job, error: null };
          if (table === 'favorites') return { data: options.favorite ? { id: 'favorite-1' } : null, error: null };
          if (table === 'applications') return { data: options.application ? { id: 'application-1' } : null, error: null };
          return { data: null, error: null };
        },
        insert: async () => { writes.push(table); return { error: null }; },
        upsert: async () => { writes.push(table); return { error: null }; },
        update: async () => { writes.push(table); return { error: null }; },
      };
      return chain;
    },
  } as PrepareAdminClient;
  return { db, reads, writes };
}

function deps(options: {
  tokenUserId?: string | null;
  admin?: ReturnType<typeof adminClient>;
  fetcher?: typeof fetch;
  envOverrides?: Record<string, string>;
} = {}): PrepareDeps {
  const admin = options.admin ?? adminClient();
  return {
    env: env(options.envOverrides),
    createUserClient: () => ({ auth: { getUser: async (token: string) => ({
      data: { user: token === 'valid-token' && options.tokenUserId !== null ? { id: options.tokenUserId ?? userId } : null },
      error: token === 'valid-token' && options.tokenUserId !== null ? null : { message: 'invalid token with secret details' },
    }) } }),
    createAdmin: () => admin.db,
    fetcher: options.fetcher ?? (async () => response(output)),
  };
}

function request(body: Record<string, unknown>, token = 'valid-token') {
  return new Request('https://example.test/ai-prepare', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('authenticated AI preparation Edge Function', () => {
  it('keeps Supabase gateway JWT verification enabled as the first auth layer', () => {
    const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
    expect(config).toMatch(/\[functions\.ai-prepare\][\s\S]*verify_jwt\s*=\s*true/);
  });

  it('validates a bearer JWT server-side and returns safe unauthorized errors', async () => {
    const handler = createPrepareHandler(deps());
    const missing = await handler(new Request('https://example.test/ai-prepare', { method: 'POST', body: '{}' }));
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Sign in to prepare for this job.' } });

    const invalid = await handler(request({ jobId, language: 'en', background }, 'bad-token'));
    expect(invalid.status).toBe(401);
    expect(JSON.stringify(await invalid.json())).not.toContain('secret');
  });

  it('rejects invalid UUID, language, and bounded background length', async () => {
    const handler = createPrepareHandler(deps());
    expect((await handler(request({ jobId: 'not-a-uuid', language: 'en', background }))).status).toBe(400);
    expect((await handler(request({ jobId, language: 'fr', background }))).status).toBe(400);
    expect((await handler(request({ jobId, language: 'en', background: 'short' }))).status).toBe(400);
    expect((await handler(request({ jobId, language: 'en', background: 'x'.repeat(2001) }))).status).toBe(400);
  });

  it('uses the token owner for inactive access and never trusts a body user id', async () => {
    const inactive = adminClient({ job: { ...canonicalJob, status: 'expired' } });
    const denied = createPrepareHandler(deps({ admin: inactive }));
    expect((await denied(request({ jobId, language: 'en', background, user_id: 'attacker-selected-id' }))).status).toBe(403);
    expect(inactive.reads.filter((read) => read.table !== 'jobs').every((read) => read.filters.some(([column, value]) => column === 'user_id' && value === userId))).toBe(true);

    const favorite = adminClient({ job: { ...canonicalJob, status: 'expired' }, favorite: true });
    expect((await createPrepareHandler(deps({ admin: favorite }))(request({ jobId, language: 'en', background }))).status).toBe(200);

    const application = adminClient({ job: { ...canonicalJob, status: 'invalid' }, application: true });
    expect((await createPrepareHandler(deps({ admin: application }))(request({ jobId, language: 'de', background }))).status).toBe(200);
  });

  it('fetches the canonical listing and calls Responses with strict bounded output without shared writes', async () => {
    const admin = adminClient();
    let providerBody: Record<string, any> | null = null;
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      providerBody = JSON.parse(String(init?.body));
      return response(output);
    }) as unknown as typeof fetch;
    const handler = createPrepareHandler(deps({ admin, fetcher, envOverrides: { OPENAI_MODEL: '' } }));

    const result = await handler(request({ jobId, language: 'en', background, title: 'Forged title', user_id: 'forged-user' }));
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ jobId, language: 'en', ...output, model: 'gpt-5.6' });
    const providerRequest = providerBody as unknown as Record<string, any>;
    expect(providerRequest).toMatchObject({ model: 'gpt-5.6', store: false, max_output_tokens: expect.any(Number) });
    expect(providerRequest.text.format).toMatchObject({ type: 'json_schema', strict: true, schema: { additionalProperties: false } });
    expect(providerRequest.input).toContain('Web apprentice');
    expect(providerRequest.input).not.toContain('Forged title');
    expect(providerRequest.input).toContain(JSON.stringify(background));
    expect(providerRequest.instructions).toContain('untrusted quoted data');
    expect(admin.writes).toEqual([]);
    expect(admin.reads.map((read) => read.table)).toEqual(['jobs']);
  });

  it('rejects malformed provider output with a safe error envelope', async () => {
    const malformed = createPrepareHandler(deps({ fetcher: async () => response({ interviewQuestions: [], skillGap: {} }) }));
    const result = await malformed(request({ jobId, language: 'en', background }));
    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({ error: { code: 'AI_INVALID_RESPONSE', message: 'The preparation service returned an invalid response.' } });

    const failed = createPrepareHandler(deps({ fetcher: async () => new Response('provider leaked openai-secret', { status: 500 }) }));
    const providerFailure = await failed(request({ jobId, language: 'en', background }));
    expect(providerFailure.status).toBe(502);
    const providerError = JSON.stringify(await providerFailure.json());
    expect(providerError).not.toContain('openai-secret');
    expect(providerError).not.toContain('provider leaked');
  });
});
