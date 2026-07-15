import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createPrepareHandler, OPENAI_TIMEOUT_MS, type PrepareAdminClient, type PrepareDeps } from '../supabase/functions/ai-prepare/handler';

const jobId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const background = 'I built a school website, enjoy programming, and work well in a team.';
const quotaWindow = '2026-07-15T17:00:00.000Z';
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

function rawResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function response(value: unknown) {
  return rawResponse({
    id: 'resp_123',
    object: 'response',
    status: 'completed',
    output: [{ id: 'msg_123', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [] }] }],
  });
}

function adminClient(options: {
  job?: Record<string, unknown> | null;
  favorite?: boolean;
  application?: boolean;
  quotaAvailable?: boolean;
  rpcError?: boolean;
} = {}) {
  const reads: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const writes: string[] = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
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
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      if (options.rpcError) return { data: null, error: { message: 'quota database secret' } };
      return { data: name === 'reserve_ai_prepare_quota' ? (options.quotaAvailable === false ? null : quotaWindow) : true, error: null };
    },
  } as PrepareAdminClient;
  return { db, reads, writes, rpcCalls };
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
    expect(providerRequest).toMatchObject({
      model: 'gpt-5.6',
      store: false,
      max_output_tokens: 1800,
      reasoning: { effort: 'none' },
    });
    expect(providerRequest.text.format).toMatchObject({ type: 'json_schema', strict: true, schema: { additionalProperties: false } });
    expect(providerRequest.input).toContain('Web apprentice');
    expect(providerRequest.input).not.toContain('Forged title');
    expect(providerRequest.input).toContain(JSON.stringify(background));
    expect(providerRequest.instructions).toContain('untrusted quoted data');
    expect(admin.writes).toEqual([]);
    expect(admin.reads.map((read) => read.table)).toEqual(['jobs']);
    expect(admin.rpcCalls).toEqual([{ name: 'reserve_ai_prepare_quota', args: { p_user_id: userId } }]);
  });

  it('atomically reserves immediately before OpenAI and returns 429 when the hourly quota is exhausted', async () => {
    const admin = adminClient({ quotaAvailable: false });
    const fetcher = vi.fn(async () => response(output)) as unknown as typeof fetch;
    const result = await createPrepareHandler(deps({ admin, fetcher }))(request({ jobId, language: 'en', background }));

    expect(result.status).toBe(429);
    expect(await result.json()).toEqual({ error: { code: 'AI_RATE_LIMITED', message: 'Your hourly preparation limit has been reached. Try again later.' } });
    expect(fetcher).not.toHaveBeenCalled();
    expect(admin.rpcCalls).toEqual([{ name: 'reserve_ai_prepare_quota', args: { p_user_id: userId } }]);
  });

  it('returns a safe service error when quota reservation fails', async () => {
    const admin = adminClient({ rpcError: true });
    const fetcher = vi.fn(async () => response(output)) as unknown as typeof fetch;
    const result = await createPrepareHandler(deps({ admin, fetcher }))(request({ jobId, language: 'en', background }));

    expect(result.status).toBe(503);
    const payload = await result.json();
    expect(payload).toEqual({ error: { code: 'AI_QUOTA_ERROR', message: 'The preparation service is temporarily unavailable.' } });
    expect(JSON.stringify(payload)).not.toContain('quota database secret');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('extracts completed output_text content across realistic response items', async () => {
    const serialized = JSON.stringify(output);
    const split = Math.floor(serialized.length / 2);
    const fetcher = async () => rawResponse({
      id: 'resp_split',
      status: 'completed',
      output: [
        { type: 'reasoning', id: 'reasoning_1', summary: [] },
        { type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: serialized.slice(0, split), annotations: [] }] },
        { type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: serialized.slice(split), annotations: [] }] },
      ],
    });

    const result = await createPrepareHandler(deps({ fetcher }))(request({ jobId, language: 'en', background }));
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject(output);
  });

  it('rejects refusal, incomplete, top-level-only, and malformed output and releases each reservation', async () => {
    const fixtures = [
      { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No.' }] }] },
      { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] },
      { status: 'completed', output_text: JSON.stringify(output), output: [] },
      { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{not-json' }] }] },
    ];

    for (const fixture of fixtures) {
      const admin = adminClient();
      const result = await createPrepareHandler(deps({ admin, fetcher: async () => rawResponse(fixture) }))(request({ jobId, language: 'en', background }));
      expect(result.status).toBe(502);
      expect(await result.json()).toEqual({ error: { code: 'AI_INVALID_RESPONSE', message: 'The preparation service returned an invalid response.' } });
      expect(admin.rpcCalls).toEqual([
        { name: 'reserve_ai_prepare_quota', args: { p_user_id: userId } },
        { name: 'release_ai_prepare_quota', args: { p_user_id: userId, p_window_started_at: quotaWindow } },
      ]);
    }
  });

  it('aborts timed-out OpenAI requests, returns a retryable 504, and releases the quota', async () => {
    vi.useFakeTimers();
    try {
      const admin = adminClient();
      let receivedSignal: AbortSignal | null | undefined;
      const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        receivedSignal = init?.signal;
        init?.signal?.addEventListener('abort', () => reject(new DOMException('provider secret timeout', 'AbortError')), { once: true });
      }));
      const fetcher = fetchMock as unknown as typeof fetch;
      const pending = createPrepareHandler(deps({ admin, fetcher }))(request({ jobId, language: 'en', background }));
      await vi.advanceTimersByTimeAsync(OPENAI_TIMEOUT_MS);
      const result = await pending;

      expect(result.status).toBe(504);
      expect(await result.json()).toEqual({ error: { code: 'AI_TIMEOUT', message: 'The preparation service timed out. Please try again.' } });
      expect(admin.rpcCalls.map((call) => call.name)).toEqual(['reserve_ai_prepare_quota', 'release_ai_prepare_quota']);
      expect(receivedSignal).toBeInstanceOf(AbortSignal);
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows enough time for a structured GPT-5.6 response while staying below the Edge Function limit', () => {
    expect(OPENAI_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
    expect(OPENAI_TIMEOUT_MS).toBeLessThan(120_000);
  });

  it('keeps the timeout active while consuming a stalled provider response body', async () => {
    vi.useFakeTimers();
    try {
      const admin = adminClient();
      let receivedSignal: AbortSignal | null | undefined;
      let rejectBody: ((reason: unknown) => void) | undefined;
      const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        receivedSignal = init?.signal;
        return {
          ok: true,
          json: () => new Promise<unknown>((_resolve, reject) => {
            rejectBody = reject;
            receivedSignal?.addEventListener('abort', () => reject(new DOMException('stalled body', 'AbortError')), { once: true });
          }),
        } as Response;
      }) as unknown as typeof fetch;
      const pending = createPrepareHandler(deps({ admin, fetcher }))(request({ jobId, language: 'en', background }));
      await vi.advanceTimersByTimeAsync(0);
      expect(rejectBody).toBeTypeOf('function');

      await vi.advanceTimersByTimeAsync(OPENAI_TIMEOUT_MS);
      if (!receivedSignal?.aborted) rejectBody?.(new Error('body timeout was cleared after headers'));
      const result = await pending;

      expect(receivedSignal?.aborted).toBe(true);
      expect(result.status).toBe(504);
      expect(await result.json()).toEqual({ error: { code: 'AI_TIMEOUT', message: 'The preparation service timed out. Please try again.' } });
      expect(admin.rpcCalls.map((call) => call.name)).toEqual(['reserve_ai_prepare_quota', 'release_ai_prepare_quota']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases quota on provider and network failures without leaking provider details', async () => {
    const providerAdmin = adminClient();
    const failed = createPrepareHandler(deps({ admin: providerAdmin, fetcher: async () => new Response('provider leaked openai-secret', { status: 500 }) }));
    const providerFailure = await failed(request({ jobId, language: 'en', background }));
    expect(providerFailure.status).toBe(502);
    expect(providerAdmin.rpcCalls.map((call) => call.name)).toEqual(['reserve_ai_prepare_quota', 'release_ai_prepare_quota']);
    const providerError = JSON.stringify(await providerFailure.json());
    expect(providerError).not.toContain('openai-secret');
    expect(providerError).not.toContain('provider leaked');

    const networkAdmin = adminClient();
    const network = createPrepareHandler(deps({ admin: networkAdmin, fetcher: async () => { throw new Error('network secret'); } }));
    const networkFailure = await network(request({ jobId, language: 'en', background }));
    expect(networkFailure.status).toBe(502);
    expect(networkAdmin.rpcCalls.map((call) => call.name)).toEqual(['reserve_ai_prepare_quota', 'release_ai_prepare_quota']);
    expect(await networkFailure.json()).toEqual({ error: { code: 'AI_PROVIDER_ERROR', message: 'The preparation service is temporarily unavailable.' } });
  });

  it('rejects schema-invalid provider output and releases its reservation', async () => {
    const admin = adminClient();
    const malformed = createPrepareHandler(deps({ admin, fetcher: async () => response({ interviewQuestions: [], skillGap: {} }) }));
    const result = await malformed(request({ jobId, language: 'en', background }));
    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({ error: { code: 'AI_INVALID_RESPONSE', message: 'The preparation service returned an invalid response.' } });
    expect(admin.rpcCalls.map((call) => call.name)).toEqual(['reserve_ai_prepare_quota', 'release_ai_prepare_quota']);
  });
});
