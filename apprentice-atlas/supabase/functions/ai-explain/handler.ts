import { errorResponse, json, options } from '../_shared/ai-http.ts';
import { explanationJsonSchema, parseExplanation, validateLanguage, type Language } from '../_shared/ai-schema.ts';
import { explanationPrompt, PROMPT_VERSION, type PromptJob } from '../_shared/prompts.ts';

export type ExplainDeps = { env: (name: string) => string; createAdmin: (url: string, key: string) => { from(table: string): any }; fetcher: typeof fetch };
const MODEL = (deps: ExplainDeps) => deps.env('OPENAI_MODEL') || 'gpt-5.6';
const jobColumns = 'id,title,company,country,city,job_type,level,category,tags,raw_description,requirements,updated_at';
const toPromptJob = (job: Record<string, any>): PromptJob => ({ title: job.title, company: job.company, country: job.country, city: job.city, jobType: job.job_type, level: job.level, category: job.category, tags: job.tags ?? [], rawDescription: job.raw_description ?? '', requirements: job.requirements ?? [] });
async function contentHash(job: Record<string, unknown>, language: Language) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ job, language, version: PROMPT_VERSION }))); return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join(''); }
async function callOpenAi(prompt: ReturnType<typeof explanationPrompt>, deps: ExplainDeps) {
  const key = deps.env('OPENAI_API_KEY');
  if (!key) throw Object.assign(new Error('AI is not configured. Set OPENAI_API_KEY in Supabase Edge Function secrets.'), { code: 'AI_CONFIGURATION_ERROR' });
  const response = await deps.fetcher('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL(deps), store: false, instructions: prompt.instructions, input: prompt.input, text: { format: { type: 'json_schema', name: 'job_explanation', strict: true, schema: explanationJsonSchema } } }) });
  if (!response.ok) throw new Error(`AI provider request failed (${response.status}).`);
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? '').join('');
  if (!text) throw new Error('AI provider returned no structured content.');
  const parsed = parseExplanation(JSON.parse(text));
  if (!parsed) throw new Error('AI provider returned invalid structured content.');
  return parsed;
}

export function createExplainHandler(deps: ExplainDeps) {
  return async function handleExplainRequest(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return options();
    if (request.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'Use POST.', 405);
    let body: { jobId?: unknown; language?: unknown };
    try { body = await request.json(); } catch { return errorResponse('INVALID_JSON', 'Request body must be JSON.', 400); }
    if (typeof body.jobId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.jobId) || !validateLanguage(body.language)) return errorResponse('INVALID_REQUEST', 'jobId and language (de or en) are required.', 400);
    const url = deps.env('SUPABASE_URL'); const serviceKey = deps.env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return errorResponse('AI_CONFIGURATION_ERROR', 'AI service is not configured.', 503);
    try {
      const db = deps.createAdmin(url, serviceKey);
      const jobResult = await db.from('jobs').select(jobColumns).eq('id', body.jobId).eq('status', 'active').maybeSingle();
      if (jobResult.error) throw new Error('Unable to load job data.');
      if (!jobResult.data) return errorResponse('JOB_NOT_FOUND', 'This active job could not be found.', 404);
      const hash = await contentHash(jobResult.data, body.language);
      const cached = await db.from('job_ai_content').select('summary,fit_reasons,considerations,generated_at,model').eq('job_id', body.jobId).eq('language_code', body.language).eq('content_type', 'explanation').eq('cache_key', hash).maybeSingle();
      if (cached.error) throw new Error('Unable to read AI cache.');
      if (cached.data) return json({ jobId: body.jobId, language: body.language, summary: cached.data.summary, goodIf: cached.data.fit_reasons ?? [], notSoGoodIf: cached.data.considerations ?? [], generatedAt: cached.data.generated_at, model: cached.data.model, cached: true });
      const output = await callOpenAi(explanationPrompt(toPromptJob(jobResult.data), body.language), deps); const generatedAt = new Date().toISOString();
      const stored = await db.from('job_ai_content').upsert({ job_id: body.jobId, language_code: body.language, content_type: 'explanation', cache_key: hash, summary: output.summary, fit_reasons: output.goodIf, considerations: output.notSoGoodIf, model: MODEL(deps), prompt_version: PROMPT_VERSION, source_content_hash: hash, generated_at: generatedAt, metadata: { model: MODEL(deps) } }, { onConflict: 'job_id,language_code,cache_key' });
      if (stored.error) throw new Error('Unable to cache AI explanation.');
      return json({ jobId: body.jobId, language: body.language, ...output, generatedAt, model: MODEL(deps), cached: false });
    } catch (error) { const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : 'AI_ERROR'; return errorResponse(code, error instanceof Error ? error.message : 'Unable to create an explanation.', code === 'AI_CONFIGURATION_ERROR' ? 503 : 500); }
  };
}
