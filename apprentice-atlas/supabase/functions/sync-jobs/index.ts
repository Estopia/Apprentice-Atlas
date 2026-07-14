// @ts-ignore Supabase Edge Functions resolve npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createBaAdapter } from '../_shared/ba-adapter.ts';
import { createUkApprenticeshipAdapter } from '../_shared/uk-apprenticeship-adapter.ts';
import { SourceConfigurationError, type SourceAdapter } from '../_shared/source-adapter.ts';
import { isSyncRequestAuthorized } from '../_shared/sync-auth.ts';
import { runSync, type SyncRepository } from '../_shared/sync-runner.ts';
import { jobInsertPayload } from '../_shared/sync-helpers.ts';
import { parseSyncRequest } from '../_shared/sync-request.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void } | undefined;

const env = (name: string): string => typeof Deno !== 'undefined' ? Deno.env.get(name) ?? '' : '';
const MAX_PAGES = Math.min(Math.max(Number(env('SYNC_MAX_PAGES') || 20), 1), 100);
const PAGE_DELAY_MS = Math.min(Math.max(Number(env('SYNC_PAGE_DELAY_MS') || 250), 0), 10_000);

type Provider = 'find-apprenticeship' | 'bundesagentur-fuer-arbeit';
type SupabaseLike = { from(table: string): any; rpc(name: string, params: Record<string, unknown>): any };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export function adapterFor(provider: Provider): SourceAdapter {
  return provider === 'find-apprenticeship' ? createUkApprenticeshipAdapter() : createBaAdapter();
}

function createSupabaseRepository(supabase: SupabaseLike): SyncRepository {
  return {
    async startRun(payload) {
      const result = await supabase.from('sync_runs').insert(payload).select('id').single();
      if (result.error || !result.data) throw new Error(`Unable to create sync run: ${result.error?.message ?? 'missing run id'}`);
      return { id: result.data.id };
    },
    async upsertJobSource(item, provider, fetchedAt) {
      const result = await supabase.rpc('upsert_job_source', {
        p_provider: provider,
        p_external_id: item.externalId,
        p_source_url: item.sourceUrl,
        p_raw_payload: item.rawRecord,
        p_job: jobInsertPayload(item, item.job.id, fetchedAt),
        p_fetched_at: fetchedAt,
      });
      if (result.error || !result.data?.[0]) throw new Error(`Unable to atomically upsert source ${item.externalId}: ${result.error?.message ?? 'missing canonical job'}`);
      return { jobId: result.data[0].job_id, inserted: Boolean(result.data[0].inserted) };
    },
    async expireStaleListings(provider, seenBefore) {
      const result = await supabase.rpc('expire_stale_source_jobs', { p_provider: provider, p_seen_before: seenBefore });
      if (result.error || typeof result.data !== 'number') throw new Error(`Unable to atomically expire stale listings: ${result.error?.message ?? 'missing expiration count'}`);
      return result.data;
    },
    async finishRun(runId, payload) {
      const result = await supabase.from('sync_runs').update(payload).eq('id', runId);
      if (result.error) throw new Error(`Unable to complete sync run: ${result.error.message}`);
    },
    async failRun(runId, payload) {
      const result = await supabase.from('sync_runs').update({ status: 'failed', ...payload }).eq('id', runId);
      if (result.error) {
        console.error('Unable to mark sync run failed', { runId, error: result.error });
        throw new Error(`Unable to mark sync run ${runId} failed: ${result.error.message}`);
      }
    },
  };
}

export async function handleSyncRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } }, 405);
  if (!isSyncRequestAuthorized(request, { internalSecret: env('SYNC_INTERNAL_SECRET'), serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY') })) return json({ error: { code: 'UNAUTHORIZED', message: 'Internal synchronization authorization required' } }, 401);
  try {
    const parsed = await parseSyncRequest(request);
    if (parsed.error) return json({ error: parsed.error }, 400);
    const body = parsed.body;
    const provider = body.provider ?? 'find-apprenticeship';
    if (provider !== 'find-apprenticeship' && provider !== 'bundesagentur-fuer-arbeit') return json({ error: { code: 'INVALID_PROVIDER', message: `Unsupported provider: ${String(provider)}` } }, 400);
    const adapter = adapterFor(provider);
    const supabaseUrl = env('SUPABASE_URL');
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new SourceConfigurationError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    const result = await runSync({ provider, sourceKey: `${provider}:${env('SYNC_SOURCE_CONFIGURATION') || 'default'}`, adapter, repository: createSupabaseRepository(createClient(supabaseUrl, serviceRoleKey)), maxPages: MAX_PAGES, pageDelayMs: PAGE_DELAY_MS });
    return json(result);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : 'SYNC_ERROR';
    return json({ error: { code, message: error instanceof Error ? error.message : String(error) } }, error instanceof SourceConfigurationError ? 503 : 500);
  }
}

if (typeof Deno !== 'undefined') Deno.serve(handleSyncRequest);
