export type Language = 'de' | 'en';

export interface ExplanationOutput {
  summary: string;
  goodIf: string[];
  notSoGoodIf: string[];
}

export interface QaOutput {
  answer: string;
  knownFromPosting: boolean;
  notSpecified: boolean;
  status: 'grounded' | 'unknown';
}

const text = (value: unknown, max = 1200): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const list = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 8 && value.every((item) => text(item, 280));

export const explanationJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: { summary: { type: 'string' }, goodIf: { type: 'array', items: { type: 'string' } }, notSoGoodIf: { type: 'array', items: { type: 'string' } } },
  required: ['summary', 'goodIf', 'notSoGoodIf'],
};

export const qaJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: { answer: { type: 'string' }, status: { type: 'string', enum: ['grounded', 'unknown'] } },
  required: ['answer', 'status'],
};

export function parseExplanation(value: unknown): ExplanationOutput | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  return text(item.summary) && list(item.goodIf) && list(item.notSoGoodIf) ? { summary: item.summary.trim(), goodIf: item.goodIf.map((x) => x.trim()), notSoGoodIf: item.notSoGoodIf.map((x) => x.trim()) } : null;
}

export function parseQa(value: unknown): QaOutput | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!text(item.answer, 900) || (item.status !== 'grounded' && item.status !== 'unknown')) return null;
  const answer = item.answer.trim();
  const disclosure = /(not specified|not mentioned|not provided|not stated|unknown|not available|nicht angegeben|nicht genannt|nicht erwähnt|nicht spezifiziert|keine information|nicht ersichtlich|steht nicht)/i.test(answer);
  if (item.status === 'unknown' && !disclosure) return null;
  if (item.status === 'grounded' && disclosure) return null;
  return item.status === 'grounded'
    ? { answer, knownFromPosting: true, notSpecified: false, status: 'grounded' }
    : { answer, knownFromPosting: false, notSpecified: true, status: 'unknown' };
}

export function validateLanguage(value: unknown): value is Language { return value === 'de' || value === 'en'; }
export function validateQuestion(value: unknown): value is string { return text(value, 300) && value.trim().length >= 3; }

export function looksLikePromptInjection(question: string): boolean {
  return /(ignore|disregard|override|reveal|system prompt|developer message|instructions? above|pretend|act as|jailbreak)/i.test(question);
}
