// @ts-ignore Supabase Edge Functions resolve npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { errorResponse, json, options } from '../_shared/ai-http.ts';
import { looksLikePromptInjection, parseQa, qaJsonSchema, validateLanguage, validateQuestion } from '../_shared/ai-schema.ts';
import { qaPrompt, type PromptJob } from '../_shared/prompts.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void } | undefined;
const env = (name: string) => typeof Deno !== 'undefined' ? Deno.env.get(name) ?? '' : '';
const MODEL = () => env('OPENAI_MODEL') || 'gpt-5.6';
const jobColumns = 'id,title,company,country,city,job_type,level,category,tags,raw_description,requirements';
const toPromptJob = (job: Record<string, any>): PromptJob => ({ title: job.title, company: job.company, country: job.country, city: job.city, jobType: job.job_type, level: job.level, category: job.category, tags: job.tags ?? [], rawDescription: job.raw_description ?? '', requirements: job.requirements ?? [] });

export async function handleQaRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return options();
  if (request.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'Use POST.', 405);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return errorResponse('INVALID_JSON', 'Request body must be JSON.', 400); }
  const { jobId, language, question, questionCount } = body;
  if (typeof jobId !== 'string' || !/^[0-9a-f-]{36}$/i.test(jobId) || !validateLanguage(language) || !validateQuestion(question)) return errorResponse('INVALID_REQUEST', 'jobId, language, and a question of 3–300 characters are required.', 400);
  if (looksLikePromptInjection(question)) return errorResponse('QUESTION_NOT_ALLOWED', 'Please ask a direct question about this job posting.', 400);
  if (typeof questionCount !== 'undefined' && (typeof questionCount !== 'number' || !Number.isInteger(questionCount) || questionCount < 0 || questionCount > 2)) return errorResponse('QUESTION_LIMIT', 'This job allows two questions per session.', 429);
  const url = env('SUPABASE_URL'); const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY'); const key = env('OPENAI_API_KEY');
  if (!url || !serviceKey || !key) return errorResponse('AI_CONFIGURATION_ERROR', 'AI service is not configured.', 503);
  try {
    const db = createClient(url, serviceKey) as { from(table: string): any };
    const result = await db.from('jobs').select(jobColumns).eq('id', jobId).eq('status', 'active').maybeSingle();
    if (result.error) throw new Error('Unable to load job data.');
    if (!result.data) return errorResponse('JOB_NOT_FOUND', 'This active job could not be found.', 404);
    const prompt = qaPrompt(toPromptJob(result.data), language, question);
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL(), store: false, instructions: prompt.instructions, input: prompt.input, text: { format: { type: 'json_schema', name: 'job_answer', strict: true, schema: qaJsonSchema } } }) });
    if (!response.ok) throw new Error(`AI provider request failed (${response.status}).`);
    const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? '').join('');
    const output = text ? parseQa(JSON.parse(text)) : null;
    if (!output) throw new Error('AI provider returned invalid structured content.');
    return json({ jobId, language, question, ...output, model: MODEL(), generatedAt: new Date().toISOString() });
  } catch (error) { return errorResponse('AI_ERROR', error instanceof Error ? error.message : 'Unable to answer this question.', 500); }
}

if (typeof Deno !== 'undefined') Deno.serve(handleQaRequest);
