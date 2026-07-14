import type { JobExplanation, JobQuestionAnswer } from '@/types/jobs';
import type { Locale } from './i18n';

export type AiError = { code: string; message: string };
export type AiResult<T> = { data: T | null; error: AiError | null };
type FunctionsClient = { functions: { invoke(name: string, options: { body: Record<string, unknown> }): Promise<{ data: unknown; error: { message?: string; context?: Response } | null }> } };

function responseError(error: { message?: string; context?: Response } | null, data: unknown): AiError {
  const payload = data && typeof data === 'object' && 'error' in data ? (data as { error?: { code?: string; message?: string } }).error : undefined;
  return { code: payload?.code ?? 'AI_ERROR', message: payload?.message ?? error?.message ?? 'The AI service is unavailable.' };
}

async function invoke<T>(name: string, body: Record<string, unknown>, validate: (value: unknown) => value is T, client?: FunctionsClient): Promise<AiResult<T>> {
  try {
    const functionsClient = client ?? (await import('./supabase')).getSupabaseClient() as unknown as FunctionsClient;
    const result = await functionsClient.functions.invoke(name, { body });
    if (result.error || !validate(result.data)) return { data: null, error: responseError(result.error, result.data) };
    return { data: result.data, error: null };
  } catch (error) { return { data: null, error: { code: 'configuration', message: error instanceof Error ? error.message : 'The AI service is unavailable.' } }; }
}

const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isExplanation = (value: unknown): value is JobExplanation => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.jobId === 'string' && (item.language === 'de' || item.language === 'en') && typeof item.summary === 'string' && isTextList(item.goodIf) && isTextList(item.notSoGoodIf) && typeof item.generatedAt === 'string';
};
const isAnswer = (value: unknown): value is JobQuestionAnswer => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.jobId === 'string' && (item.language === 'de' || item.language === 'en') && typeof item.question === 'string' && typeof item.answer === 'string' && typeof item.knownFromPosting === 'boolean' && typeof item.notSpecified === 'boolean' && typeof item.generatedAt === 'string';
};

export function explainJob(jobId: string, language: Locale, client?: FunctionsClient) { return invoke<JobExplanation>('ai-explain', { jobId, language }, isExplanation, client); }
export function askJobQuestion(jobId: string, language: Locale, question: string, questionCount: number, client?: FunctionsClient) { return invoke<JobQuestionAnswer>('ai-qa', { jobId, language, question, questionCount }, isAnswer, client); }
