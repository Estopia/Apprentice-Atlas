import { errorResponse, json, options } from '../_shared/ai-http.ts';
import { parsePreparation, preparationJsonSchema, validateBackground, validateLanguage, type Language } from '../_shared/ai-schema.ts';
import { preparePrompt, type PromptJob } from '../_shared/prompts.ts';

type QueryError = { message?: string } | null;
type QueryResult = Promise<{ data: Record<string, unknown> | null; error: QueryError }>;

export type PrepareUserClient = {
  auth: { getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: QueryError }> };
};
export type PrepareQuery = {
  select(columns: string): PrepareQuery;
  eq(column: string, value: unknown): PrepareQuery;
  limit(value: number): PrepareQuery;
  maybeSingle(): QueryResult;
};
export type PrepareAdminClient = { from(table: string): PrepareQuery };
export type PrepareDeps = {
  env(name: string): string;
  createUserClient(url: string, anonKey: string): PrepareUserClient;
  createAdmin(url: string, serviceKey: string): PrepareAdminClient;
  fetcher: typeof fetch;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JOB_COLUMNS = 'id,title,company,country,city,job_type,level,category,tags,raw_description,requirements,status,expires_at';
const MAX_OUTPUT_TOKENS = 2200;
const model = (deps: PrepareDeps) => deps.env('OPENAI_MODEL') || 'gpt-5.6';

const toPromptJob = (job: Record<string, unknown>): PromptJob => ({
  title: String(job.title ?? ''),
  company: String(job.company ?? ''),
  country: String(job.country ?? ''),
  city: String(job.city ?? ''),
  jobType: String(job.job_type ?? ''),
  level: String(job.level ?? ''),
  category: String(job.category ?? ''),
  tags: Array.isArray(job.tags) ? job.tags.filter((item): item is string => typeof item === 'string') : [],
  rawDescription: typeof job.raw_description === 'string' ? job.raw_description : '',
  requirements: Array.isArray(job.requirements) ? job.requirements.filter((item): item is string => typeof item === 'string') : [],
});

const isActiveJob = (job: Record<string, unknown>) => job.status === 'active'
  && (job.expires_at === null || typeof job.expires_at !== 'string' || Date.parse(job.expires_at) > Date.now());

async function ownsInactiveJob(db: PrepareAdminClient, jobId: string, userId: string): Promise<boolean> {
  const [favorite, application] = await Promise.all([
    db.from('favorites').select('id').eq('job_id', jobId).eq('user_id', userId).limit(1).maybeSingle(),
    db.from('applications').select('id').eq('job_id', jobId).eq('user_id', userId).limit(1).maybeSingle(),
  ]);
  if (favorite.error || application.error) throw new Error('ownership-query-failed');
  return Boolean(favorite.data || application.data);
}

function extractOutputText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const item = payload as { output_text?: unknown; output?: Array<{ content?: Array<{ text?: unknown }> }> };
  if (typeof item.output_text === 'string' && item.output_text) return item.output_text;
  const text = item.output?.flatMap((output) => output.content ?? []).map((content) => typeof content.text === 'string' ? content.text : '').join('') ?? '';
  return text || null;
}

export function createPrepareHandler(deps: PrepareDeps) {
  return async function handlePrepareRequest(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return options();
    if (request.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'Use POST.', 405);

    const token = request.headers.get('authorization')?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
    if (!token) return errorResponse('UNAUTHORIZED', 'Sign in to prepare for this job.', 401);

    const url = deps.env('SUPABASE_URL');
    const anonKey = deps.env('SUPABASE_ANON_KEY');
    const serviceKey = deps.env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) return errorResponse('AI_CONFIGURATION_ERROR', 'The preparation service is unavailable.', 503);

    let userId: string;
    try {
      const auth = await deps.createUserClient(url, anonKey).auth.getUser(token);
      if (auth.error || !auth.data.user) return errorResponse('UNAUTHORIZED', 'Sign in to prepare for this job.', 401);
      userId = auth.data.user.id;
    } catch {
      return errorResponse('UNAUTHORIZED', 'Sign in to prepare for this job.', 401);
    }

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return errorResponse('INVALID_JSON', 'Request body must be JSON.', 400); }
    const { jobId, language, background } = body;
    if (typeof jobId !== 'string' || !UUID_PATTERN.test(jobId) || !validateLanguage(language) || !validateBackground(background)) {
      return errorResponse('INVALID_REQUEST', 'A valid job, language, and background of 10–2000 characters are required.', 400);
    }

    try {
      const db = deps.createAdmin(url, serviceKey);
      const jobResult = await db.from('jobs').select(JOB_COLUMNS).eq('id', jobId).maybeSingle();
      if (jobResult.error) throw new Error('job-query-failed');
      if (!jobResult.data) return errorResponse('JOB_NOT_FOUND', 'This job could not be found.', 404);
      if (!isActiveJob(jobResult.data) && !await ownsInactiveJob(db, jobId, userId)) {
        return errorResponse('JOB_ACCESS_DENIED', 'This job is no longer available for preparation.', 403);
      }

      const key = deps.env('OPENAI_API_KEY');
      if (!key) return errorResponse('AI_CONFIGURATION_ERROR', 'The preparation service is unavailable.', 503);
      const prompt = preparePrompt(toPromptJob(jobResult.data), language as Language, background.trim());
      const provider = await deps.fetcher('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: model(deps),
          store: false,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          instructions: prompt.instructions,
          input: prompt.input,
          text: { format: { type: 'json_schema', name: 'job_preparation', strict: true, schema: preparationJsonSchema } },
        }),
      });
      if (!provider.ok) return errorResponse('AI_PROVIDER_ERROR', 'The preparation service is temporarily unavailable.', 502);
      const outputText = extractOutputText(await provider.json());
      let parsed: ReturnType<typeof parsePreparation> = null;
      try { parsed = outputText ? parsePreparation(JSON.parse(outputText)) : null; } catch { parsed = null; }
      if (!parsed) return errorResponse('AI_INVALID_RESPONSE', 'The preparation service returned an invalid response.', 502);
      return json({ jobId, language, ...parsed, generatedAt: new Date().toISOString(), model: model(deps) });
    } catch {
      return errorResponse('AI_ERROR', 'Unable to create preparation right now.', 500);
    }
  };
}
