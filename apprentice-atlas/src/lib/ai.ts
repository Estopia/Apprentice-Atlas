import type { InterviewPreparationQuestion, JobExplanation, JobPreparation, JobQuestionAnswer, JobSkillGap } from '@/types/jobs';
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
    let errorData = result.data;
    if (result.error?.context) {
      try { errorData = await result.error.context.clone().json(); } catch { /* Keep the SDK error message when the response has no JSON body. */ }
    }
    if (result.error || !validate(result.data)) return { data: null, error: responseError(result.error, errorData) };
    return { data: result.data, error: null };
  } catch (error) { return { data: null, error: { code: 'configuration', message: error instanceof Error ? error.message : 'The AI service is unavailable.' } }; }
}

const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every((key) => keys.includes(key));
const isBoundedText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const hasEligibilityCertainty = (value: string) => /\b(?:you are|you're)\s+(?:definitely\s+|certainly\s+)?(?:eligible|qualified)\b|\b(?:du bist|sie sind)\s+(?:definitiv\s+|eindeutig\s+|sicher\s+)?(?:für\s+[^.]{1,60}\s+)?(?:geeignet|qualifiziert)\b|\b(?:guaranteed to be hired|will definitely be hired|wirst garantiert eingestellt)\b/i.test(value);
const isBoundedList = (value: unknown, maxItems: number): value is string[] => Array.isArray(value) && value.length <= maxItems && value.every((item) => isBoundedText(item, 420) && !hasEligibilityCertainty(item));
const isExplanation = (value: unknown): value is JobExplanation => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.jobId === 'string' && (item.language === 'de' || item.language === 'en') && typeof item.summary === 'string' && isTextList(item.goodIf) && isTextList(item.notSoGoodIf) && typeof item.generatedAt === 'string';
};
const isAnswer = (value: unknown): value is JobQuestionAnswer => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.jobId === 'string' && (item.language === 'de' || item.language === 'en') && typeof item.question === 'string' && typeof item.answer === 'string' && typeof item.knownFromPosting === 'boolean' && typeof item.notSpecified === 'boolean' && (item.status === 'grounded' || item.status === 'unknown') && Array.isArray(item.evidence) && item.evidence.every((evidence) => typeof evidence === 'string') && typeof item.generatedAt === 'string';
};

const isPreparationQuestion = (value: unknown): value is InterviewPreparationQuestion => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return hasOnlyKeys(item, ['question', 'whyAsked', 'answerTip'])
    && isBoundedText(item.question, 320)
    && isBoundedText(item.whyAsked, 420)
    && isBoundedText(item.answerTip, 520)
    && !hasEligibilityCertainty(item.question)
    && !hasEligibilityCertainty(item.whyAsked)
    && !hasEligibilityCertainty(item.answerTip);
};

const isSkillGap = (value: unknown): value is JobSkillGap => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return hasOnlyKeys(item, ['matches', 'gaps', 'positioningTips'])
    && isBoundedList(item.matches, 8)
    && isBoundedList(item.gaps, 8)
    && isBoundedList(item.positioningTips, 6);
};

const isPreparation = (value: unknown): value is JobPreparation => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return hasOnlyKeys(item, ['jobId', 'language', 'interviewQuestions', 'skillGap', 'generatedAt', 'model'])
    && typeof item.jobId === 'string'
    && (item.language === 'de' || item.language === 'en')
    && Array.isArray(item.interviewQuestions)
    && item.interviewQuestions.length >= 3
    && item.interviewQuestions.length <= 5
    && item.interviewQuestions.every(isPreparationQuestion)
    && isSkillGap(item.skillGap)
    && typeof item.generatedAt === 'string'
    && (typeof item.model === 'undefined' || typeof item.model === 'string');
};

export function explainJob(jobId: string, language: Locale, client?: FunctionsClient) { return invoke<JobExplanation>('ai-explain', { jobId, language }, isExplanation, client); }
export function askJobQuestion(jobId: string, language: Locale, question: string, questionCount: number, sessionId: string, client?: FunctionsClient) { return invoke<JobQuestionAnswer>('ai-qa', { jobId, language, question, questionCount, sessionId }, isAnswer, client); }
export function prepareForJob(jobId: string, language: Locale, background: string, client?: FunctionsClient) { return invoke<JobPreparation>('ai-prepare', { jobId, language, background }, isPreparation, client); }
