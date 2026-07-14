import { errorResponse, json, options } from '../_shared/ai-http.ts';
import { looksLikePromptInjection, parseQa, qaJsonSchema, validateLanguage, validateQuestion } from '../_shared/ai-schema.ts';
import { qaPrompt, type PromptJob } from '../_shared/prompts.ts';

export type QaDeps = { env: (name: string) => string; createAdmin: (url: string, key: string) => { from(table: string): any; rpc(name: string, params: Record<string, unknown>): any }; fetcher: typeof fetch };
const MODEL = (deps: QaDeps) => deps.env('OPENAI_MODEL') || 'gpt-5.6';
const jobColumns = 'id,title,company,country,city,job_type,level,category,tags,raw_description,requirements';
const toPromptJob = (job: Record<string, any>): PromptJob => ({ title: job.title, company: job.company, country: job.country, city: job.city, jobType: job.job_type, level: job.level, category: job.category, tags: job.tags ?? [], rawDescription: job.raw_description ?? '', requirements: job.requirements ?? [] });

export function createQaHandler(deps: QaDeps) {
  return async function handleQaRequest(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return options();
    if (request.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'Use POST.', 405);
    let body: Record<string, unknown>; try { body = await request.json(); } catch { return errorResponse('INVALID_JSON', 'Request body must be JSON.', 400); }
    const { jobId, language, question, questionCount, sessionId } = body;
    if (typeof jobId !== 'string' || !/^[0-9a-f-]{36}$/i.test(jobId) || typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId) || !validateLanguage(language) || !validateQuestion(question)) return errorResponse('INVALID_REQUEST', 'jobId, language, sessionId, and a question of 3–300 characters are required.', 400);
    if (looksLikePromptInjection(question)) return errorResponse('QUESTION_NOT_ALLOWED', 'Please ask a direct question about this job posting.', 400);
    if (typeof questionCount !== 'undefined' && (typeof questionCount !== 'number' || !Number.isInteger(questionCount) || questionCount < 0 || questionCount > 2)) return errorResponse('QUESTION_LIMIT', 'This job allows two questions per session.', 429);
    const url = deps.env('SUPABASE_URL'); const serviceKey = deps.env('SUPABASE_SERVICE_ROLE_KEY'); const key = deps.env('OPENAI_API_KEY');
    if (!url || !serviceKey || !key) return errorResponse('AI_CONFIGURATION_ERROR', 'AI service is not configured.', 503);
    try {
      const db = deps.createAdmin(url, serviceKey); const result = await db.from('jobs').select(jobColumns).eq('id', jobId).eq('status', 'active').maybeSingle();
      if (result.error) throw new Error('Unable to load job data.'); if (!result.data) return errorResponse('JOB_NOT_FOUND', 'This active job could not be found.', 404);
      const consumed = await db.rpc('consume_job_ai_question', { p_job_id: jobId, p_session_id: sessionId });
      if (consumed.error) throw new Error('Unable to check the question limit.'); if (consumed.data === null || consumed.data === undefined) return errorResponse('QUESTION_LIMIT', 'This job allows two questions per session.', 429);
      const prompt = qaPrompt(toPromptJob(result.data), language, question); const response = await deps.fetcher('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL(deps), store: false, instructions: prompt.instructions, input: prompt.input, text: { format: { type: 'json_schema', name: 'job_answer', strict: true, schema: qaJsonSchema } } }) });
      if (!response.ok) throw new Error(`AI provider request failed (${response.status}).`); const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }; const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? '').join(''); const output = text ? parseQa(JSON.parse(text)) : null;
      if (!output) throw new Error('AI provider returned invalid structured content.'); return json({ jobId, language, question, ...output, model: MODEL(deps), generatedAt: new Date().toISOString() });
    } catch (error) { return errorResponse('AI_ERROR', error instanceof Error ? error.message : 'Unable to answer this question.', 500); }
  };
}
