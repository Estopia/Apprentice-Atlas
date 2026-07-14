import { describe, expect, it, vi } from 'vitest';

const modulePath = '../src/lib/applications';
const userId = '33333333-3333-4333-8333-333333333333';
const jobId = '11111111-1111-4111-8111-111111111111';

const jobRow = {
  id: jobId,
  title: 'Frontend apprentice',
  company: 'Atlas',
  country: 'DE',
  city: 'Berlin',
  latitude: null,
  longitude: null,
  job_type: 'apprenticeship',
  level: 'entry',
  category: 'technology',
  tags: ['typescript'],
  raw_description: 'Build useful things.',
  requirements: [],
  source_url: 'https://example.test/job',
  application_url: 'https://example.test/apply',
  source_name: 'Official source',
  status: 'active',
  last_seen_at: '2026-07-14T00:00:00.000Z',
  expires_at: null,
  created_at: '2026-07-13T00:00:00.000Z',
  updated_at: '2026-07-14T00:00:00.000Z',
};

const applicationRow = {
  id: '22222222-2222-4222-8222-222222222222',
  user_id: userId,
  job_id: jobId,
  status: 'interview',
  note: 'Bring portfolio',
  created_at: '2026-07-14T10:00:00.000Z',
  updated_at: '2026-07-14T11:00:00.000Z',
  jobs: jobRow,
};

describe('application operations', () => {
  it('requires an authenticated session for every operation', async () => {
    const { getApplicationForJob, listApplications, removeApplication, upsertApplication } = await import(modulePath);
    const client = createClient({ userId: null });

    await expect(listApplications(client as never)).resolves.toMatchObject({ data: null, error: { code: 'auth-required' } });
    await expect(getApplicationForJob(jobId, client as never)).resolves.toMatchObject({ data: null, error: { code: 'auth-required' } });
    await expect(upsertApplication(jobId, 'applied', null, client as never)).resolves.toMatchObject({ data: null, error: { code: 'auth-required' } });
    await expect(removeApplication(jobId, client as never)).resolves.toMatchObject({ data: null, error: { code: 'auth-required' } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('lists only the current user rows, maps valid data, and preserves a missing job', async () => {
    const { listApplications } = await import(modulePath);
    const unavailableRow = { ...applicationRow, id: '44444444-4444-4444-8444-444444444444', job_id: '55555555-5555-4555-8555-555555555555', status: 'closed', note: null, jobs: null };
    const client = createClient({ listData: [applicationRow, unavailableRow] });

    const result = await listApplications(client as never);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        id: applicationRow.id,
        userId,
        jobId,
        status: 'interview',
        note: 'Bring portfolio',
        createdAt: applicationRow.created_at,
        updatedAt: applicationRow.updated_at,
        job: expect.objectContaining({ id: jobId, title: 'Frontend apprentice', jobType: 'apprenticeship' }),
      },
      {
        id: unavailableRow.id,
        userId,
        jobId: unavailableRow.job_id,
        status: 'closed',
        note: null,
        createdAt: unavailableRow.created_at,
        updatedAt: unavailableRow.updated_at,
        job: undefined,
      },
    ]);
    expect(client.query.select).toHaveBeenCalledWith(expect.stringMatching(/jobs\(\*\)/));
    expect(client.query.eq).toHaveBeenCalledWith('user_id', userId);
    expect(client.query.order).toHaveBeenCalledWith('updated_at', { ascending: false });
  });

  it('returns a typed validation error for malformed database rows', async () => {
    const { listApplications } = await import(modulePath);
    const client = createClient({ listData: [{ ...applicationRow, status: 'published' }] });

    await expect(listApplications(client as never)).resolves.toMatchObject({
      data: null,
      error: { code: 'validation' },
    });
  });

  it('gets one application using both the current user and job id', async () => {
    const { getApplicationForJob } = await import(modulePath);
    const client = createClient({ singleData: applicationRow });

    const result = await getApplicationForJob(jobId, client as never);

    expect(result.data).toMatchObject({ jobId, userId, status: 'interview' });
    expect(client.query.eq).toHaveBeenNthCalledWith(1, 'user_id', userId);
    expect(client.query.eq).toHaveBeenNthCalledWith(2, 'job_id', jobId);
    expect(client.query.maybeSingle).toHaveBeenCalledOnce();
  });

  it('derives ownership from the session and normalizes the note when upserting', async () => {
    const { upsertApplication } = await import(modulePath);
    const client = createClient({ singleData: { ...applicationRow, status: 'preparing', note: null } });

    const result = await upsertApplication(jobId, 'preparing', '   ', client as never);

    expect(result.data).toMatchObject({ userId, jobId, status: 'preparing', note: null });
    expect(client.query.upsert).toHaveBeenCalledWith(
      { user_id: userId, job_id: jobId, status: 'preparing', note: null },
      { onConflict: 'user_id,job_id' },
    );
    expect(client.query.select).toHaveBeenCalledWith(expect.stringMatching(/jobs\(\*\)/));
  });

  it('rejects invalid statuses and notes longer than 500 trimmed characters without querying', async () => {
    const { upsertApplication } = await import(modulePath);
    const invalidStatusClient = createClient();
    const invalidNoteClient = createClient();

    await expect(upsertApplication(jobId, 'pending' as never, null, invalidStatusClient as never)).resolves.toMatchObject({ data: null, error: { code: 'validation' } });
    await expect(upsertApplication(jobId, 'applied', ` ${'x'.repeat(501)} `, invalidNoteClient as never)).resolves.toMatchObject({ data: null, error: { code: 'validation' } });
    expect(invalidStatusClient.from).not.toHaveBeenCalled();
    expect(invalidNoteClient.from).not.toHaveBeenCalled();
  });

  it('removes only the current user application for the requested job', async () => {
    const { removeApplication } = await import(modulePath);
    const client = createClient();

    await expect(removeApplication(jobId, client as never)).resolves.toEqual({ data: null, error: null });
    expect(client.query.delete).toHaveBeenCalledOnce();
    expect(client.query.eq).toHaveBeenNthCalledWith(1, 'user_id', userId);
    expect(client.query.eq).toHaveBeenNthCalledWith(2, 'job_id', jobId);
  });

  it('returns typed query and mutation errors instead of throwing', async () => {
    const { listApplications, upsertApplication } = await import(modulePath);
    const queryClient = createClient({ error: new Error('database unavailable') });
    const mutationClient = createClient({ error: new Error('write unavailable') });

    await expect(listApplications(queryClient as never)).resolves.toMatchObject({ data: null, error: { code: 'query', message: 'database unavailable' } });
    await expect(upsertApplication(jobId, 'offer', '  Great news  ', mutationClient as never)).resolves.toMatchObject({ data: null, error: { code: 'mutation', message: 'write unavailable' } });
    expect(mutationClient.query.upsert).toHaveBeenCalledWith(expect.objectContaining({ note: 'Great news' }), expect.anything());
  });
});

function createClient(options: { userId?: string | null; listData?: unknown[]; singleData?: unknown; error?: Error; authError?: Error } = {}) {
  const resolvedUserId = options.userId === undefined ? userId : options.userId;
  let operation: 'read' | 'upsert' | 'delete' = 'read';
  let equalityCount = 0;
  const result = () => ({ data: null, error: options.error ?? null });
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => {
      equalityCount += 1;
      if (operation === 'delete' && equalityCount === 2) return Promise.resolve(result());
      return query;
    }),
    order: vi.fn(async () => ({ data: options.listData ?? [], error: options.error ?? null })),
    maybeSingle: vi.fn(async () => ({ data: options.singleData ?? null, error: options.error ?? null })),
    single: vi.fn(async () => ({ data: options.singleData ?? null, error: options.error ?? null })),
    upsert: vi.fn(() => { operation = 'upsert'; return query; }),
    delete: vi.fn(() => { operation = 'delete'; equalityCount = 0; return query; }),
  };
  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: resolvedUserId ? { user: { id: resolvedUserId } } : null },
        error: options.authError ?? null,
      })),
    },
    from: vi.fn(() => { operation = 'read'; equalityCount = 0; return query; }),
    query,
  };
}
