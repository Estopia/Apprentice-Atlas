// @ts-ignore Supabase Edge Functions resolve npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BaAdapter } from '../_shared/ba-adapter.ts';
import { createUkApprenticeshipAdapter } from '../_shared/uk-apprenticeship-adapter.ts';
import { dedupeByExternalId, SourceConfigurationError, type NormalizedSourceRecord, type SourceAdapter } from '../_shared/source-adapter.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void } | undefined;

const env = (name: string): string => typeof Deno !== 'undefined' ? Deno.env.get(name) ?? '' : '';
const MAX_PAGES = Math.min(Math.max(Number(env('SYNC_MAX_PAGES') || 20), 1), 100);
const PAGE_DELAY_MS = Math.min(Math.max(Number(env('SYNC_PAGE_DELAY_MS') || 250), 0), 10_000);

type Provider = 'find-apprenticeship' | 'bundesagentur-fuer-arbeit';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function authorized(request: Request): boolean {
  const authorization = request.headers.get('authorization') ?? '';
  const suppliedSecret = request.headers.get('x-sync-internal-secret') ?? '';
  const expected = env('SYNC_INTERNAL_SECRET');
  const serviceRole = env('SUPABASE_SERVICE_ROLE_KEY');
  return Boolean((expected && suppliedSecret === expected) || (expected && authorization === `Bearer ${expected}`) || (serviceRole && authorization === `Bearer ${serviceRole}`));
}

function adapterFor(provider: Provider): SourceAdapter {
  return provider === 'find-apprenticeship' ? createUkApprenticeshipAdapter() : new BaAdapter();
}

async function syncProvider(provider: Provider) {
  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new SourceConfigurationError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const adapter = adapterFor(provider);
  const sourceKey = `${provider}:${env('SYNC_SOURCE_CONFIGURATION') || 'default'}`;
  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await supabase.from('sync_runs').insert({ provider, source_key: sourceKey, source_provider: provider, status: 'running', started_at: startedAt }).select('id').single();
  if (runError || !run) throw new Error(`Unable to create sync run: ${runError?.message ?? 'missing run id'}`);

  const counts = { fetched_count: 0, inserted_count: 0, updated_count: 0, expired_count: 0, error_count: 0 };
  const errors: Array<{ code: string; message: string; externalId?: string }> = [];
  let cursor: string | null = null;
  let complete = false;
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await adapter.fetchPage(cursor);
      counts.fetched_count += result.records.length;
      const normalized = dedupeByExternalId(result.records.map((record) => adapter.normalize(record)).filter((record): record is NormalizedSourceRecord => record !== null));
      for (const item of normalized) {
        const existing = await supabase.from('job_sources').select('id, job_id').eq('provider', provider).eq('external_id', item.externalId).maybeSingle();
        if (existing.error) throw new Error(`Unable to read source ${item.externalId}: ${existing.error.message}`);
        const jobId = existing.data?.job_id ?? item.job.id;
        const jobPayload = { ...jobColumns(item.job), id: jobId, last_seen_at: startedAt, updated_at: startedAt };
        const job = await supabase.from('jobs').upsert(jobPayload, { onConflict: 'id' });
        if (job.error) throw new Error(`Unable to upsert job ${item.externalId}: ${job.error.message}`);
        const source = await supabase.from('job_sources').upsert({ job_id: jobId, provider, external_id: item.externalId, source_url: item.sourceUrl, raw_payload: item.rawRecord, status: 'active', fetched_at: startedAt }, { onConflict: 'provider,external_id' });
        if (source.error) throw new Error(`Unable to upsert source ${item.externalId}: ${source.error.message}`);
        if (existing.data) counts.updated_count += 1; else counts.inserted_count += 1;
      }
      cursor = result.nextCursor;
      complete = result.complete || cursor === null;
      if (complete) break;
      if (PAGE_DELAY_MS) await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
    }
    if (!complete) errors.push({ code: 'PAGE_BOUND_REACHED', message: `Stopped after ${MAX_PAGES} pages before the source reported completion` });
    if (complete) {
      const expiredSources = await supabase.from('job_sources').update({ status: 'retired' }).eq('provider', provider).eq('status', 'active').lt('fetched_at', startedAt).select('job_id');
      if (expiredSources.error) throw new Error(`Unable to retire stale sources: ${expiredSources.error.message}`);
      const expiredJobs = await supabase.from('jobs').update({ status: 'expired', updated_at: startedAt }).eq('source_name', provider).eq('status', 'active').lt('last_seen_at', startedAt).select('id');
      if (expiredJobs.error) throw new Error(`Unable to expire stale jobs: ${expiredJobs.error.message}`);
      counts.expired_count = expiredJobs.data?.length ?? 0;
    }
    const status = errors.length ? 'partial' : 'succeeded';
    await supabase.from('sync_runs').update({ ...counts, status, finished_at: new Date().toISOString(), error_count: errors.length, error_details: errors.length ? errors : null }).eq('id', run.id);
    return { provider, status, ...counts, errors };
  } catch (error) {
    const structured = { code: error instanceof SourceConfigurationError ? error.code : 'SYNC_ERROR', message: error instanceof Error ? error.message : String(error) };
    await supabase.from('sync_runs').update({ ...counts, status: 'failed', finished_at: new Date().toISOString(), error_count: counts.error_count + 1, error_details: [structured] }).eq('id', run.id);
    throw error;
  }
}

function jobColumns(job: NormalizedSourceRecord['job']) {
  return { title: job.title, company: job.company, country: job.country, city: job.city, latitude: job.latitude, longitude: job.longitude, job_type: job.jobType, level: job.level, category: job.category, tags: job.tags, raw_description: job.rawDescription, requirements: job.requirements, source_url: job.sourceUrl, source_name: job.sourceName, status: job.status, expires_at: job.expiresAt, created_at: job.createdAt };
}

export async function handleSyncRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } }, 405);
  if (!authorized(request)) return json({ error: { code: 'UNAUTHORIZED', message: 'Internal synchronization authorization required' } }, 401);
  try {
    const body = await request.json().catch(() => ({})) as { provider?: Provider };
    const provider = body.provider ?? 'find-apprenticeship';
    if (provider !== 'find-apprenticeship' && provider !== 'bundesagentur-fuer-arbeit') return json({ error: { code: 'INVALID_PROVIDER', message: `Unsupported provider: ${String(provider)}` } }, 400);
    return json(await syncProvider(provider));
  } catch (error) {
    const code = error instanceof SourceConfigurationError ? error.code : 'SYNC_ERROR';
    return json({ error: { code, message: error instanceof Error ? error.message : String(error) } }, code === 'SOURCE_CONFIGURATION_ERROR' ? 503 : 500);
  }
}

if (typeof Deno !== 'undefined') Deno.serve(handleSyncRequest);
