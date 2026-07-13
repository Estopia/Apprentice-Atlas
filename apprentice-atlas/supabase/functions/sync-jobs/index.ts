// @ts-ignore Supabase Edge Functions resolve npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BaAdapter } from '../_shared/ba-adapter.ts';
import { createUkApprenticeshipAdapter } from '../_shared/uk-apprenticeship-adapter.ts';
import { SourceConfigurationError, type SourceAdapter } from '../_shared/source-adapter.ts';
import { isSyncRequestAuthorized } from '../_shared/sync-auth.ts';
import { runSync, type SyncRepository } from '../_shared/sync-runner.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void } | undefined;

const env = (name: string): string => typeof Deno !== 'undefined' ? Deno.env.get(name) ?? '' : '';
const MAX_PAGES = Math.min(Math.max(Number(env('SYNC_MAX_PAGES') || 20), 1), 100);
const PAGE_DELAY_MS = Math.min(Math.max(Number(env('SYNC_PAGE_DELAY_MS') || 250), 0), 10_000);

type Provider = 'find-apprenticeship' | 'bundesagentur-fuer-arbeit';
type SupabaseLike = { from(table: string): any };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function adapterFor(provider: Provider): SourceAdapter {
  return provider === 'find-apprenticeship' ? createUkApprenticeshipAdapter() : new BaAdapter();
}

function createSupabaseRepository(supabase: SupabaseLike): SyncRepository {
  return {
    async startRun(payload) {
      const result = await supabase.from('sync_runs').insert(payload).select('id').single();
      if (result.error || !result.data) throw new Error(`Unable to create sync run: ${result.error?.message ?? 'missing run id'}`);
      return { id: result.data.id };
    },
    async findSource(provider, externalId) {
      const result = await supabase.from('job_sources').select('job_id').eq('provider', provider).eq('external_id', externalId).maybeSingle();
      if (result.error) throw new Error(`Unable to read source ${externalId}: ${result.error.message}`);
      return result.data ? { jobId: result.data.job_id } : null;
    },
    async insertJob(payload) {
      const result = await supabase.from('jobs').insert(payload);
      if (result.error) throw new Error(`Unable to insert job: ${result.error.message}`);
    },
    async updateJob(jobId, payload) {
      const result = await supabase.from('jobs').update(payload).eq('id', jobId);
      if (result.error) throw new Error(`Unable to update job ${jobId}: ${result.error.message}`);
    },
    async upsertSource(payload) {
      const result = await supabase.from('job_sources').upsert(payload, { onConflict: 'provider,external_id' });
      if (result.error) throw new Error(`Unable to upsert source ${payload.external_id}: ${result.error.message}`);
    },
    async expireStaleListings(provider, seenBefore) {
      const sources = await supabase.from('job_sources').update({ status: 'retired' }).eq('provider', provider).eq('status', 'active').lt('fetched_at', seenBefore).select('job_id');
      if (sources.error) throw new Error(`Unable to retire stale sources: ${sources.error.message}`);
      const jobs = await supabase.from('jobs').update({ status: 'expired', updated_at: seenBefore }).eq('source_name', provider).eq('status', 'active').lt('last_seen_at', seenBefore).select('id');
      if (jobs.error) throw new Error(`Unable to expire stale jobs: ${jobs.error.message}`);
      return jobs.data?.length ?? 0;
    },
    async finishRun(runId, payload) {
      const result = await supabase.from('sync_runs').update(payload).eq('id', runId);
      if (result.error) throw new Error(`Unable to complete sync run: ${result.error.message}`);
    },
    async failRun(runId, payload) {
      await supabase.from('sync_runs').update({ status: 'failed', ...payload }).eq('id', runId);
    },
  };
}

export async function handleSyncRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } }, 405);
  if (!isSyncRequestAuthorized(request, { internalSecret: env('SYNC_INTERNAL_SECRET'), serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY') })) return json({ error: { code: 'UNAUTHORIZED', message: 'Internal synchronization authorization required' } }, 401);
  try {
    const body = await request.json().catch(() => ({})) as { provider?: Provider };
    const provider = body.provider ?? 'find-apprenticeship';
    if (provider !== 'find-apprenticeship' && provider !== 'bundesagentur-fuer-arbeit') return json({ error: { code: 'INVALID_PROVIDER', message: `Unsupported provider: ${String(provider)}` } }, 400);
    const supabaseUrl = env('SUPABASE_URL');
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new SourceConfigurationError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    const result = await runSync({ provider, sourceKey: `${provider}:${env('SYNC_SOURCE_CONFIGURATION') || 'default'}`, adapter: adapterFor(provider), repository: createSupabaseRepository(createClient(supabaseUrl, serviceRoleKey)), maxPages: MAX_PAGES, pageDelayMs: PAGE_DELAY_MS });
    return json(result);
  } catch (error) {
    const code = error instanceof SourceConfigurationError ? error.code : 'SYNC_ERROR';
    return json({ error: { code, message: error instanceof Error ? error.message : String(error) } }, code === 'SOURCE_CONFIGURATION_ERROR' ? 503 : 500);
  }
}

if (typeof Deno !== 'undefined') Deno.serve(handleSyncRequest);
