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
  evidence: string[];
}

export interface PreparationQuestionOutput {
  question: string;
  whyAsked: string;
  answerTip: string;
}

export interface PreparationOutput {
  interviewQuestions: PreparationQuestionOutput[];
  skillGap: {
    matches: string[];
    gaps: string[];
    positioningTips: string[];
  };
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
  properties: { answer: { type: 'string' }, status: { type: 'string', enum: ['grounded', 'unknown'] }, evidence: { type: 'array', items: { type: 'string' } } },
  required: ['answer', 'status', 'evidence'],
};

const boundedStringSchema = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength });
const boundedStringListSchema = (maxItems: number) => ({ type: 'array', minItems: 0, maxItems, items: boundedStringSchema(420) });

export const preparationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    interviewQuestions: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: boundedStringSchema(320),
          whyAsked: boundedStringSchema(420),
          answerTip: boundedStringSchema(520),
        },
        required: ['question', 'whyAsked', 'answerTip'],
      },
    },
    skillGap: {
      type: 'object',
      additionalProperties: false,
      properties: {
        matches: boundedStringListSchema(8),
        gaps: boundedStringListSchema(8),
        positioningTips: boundedStringListSchema(6),
      },
      required: ['matches', 'gaps', 'positioningTips'],
    },
  },
  required: ['interviewQuestions', 'skillGap'],
};

export function parseExplanation(value: unknown): ExplanationOutput | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  return text(item.summary) && list(item.goodIf) && list(item.notSoGoodIf) ? { summary: item.summary.trim(), goodIf: item.goodIf.map((x) => x.trim()), notSoGoodIf: item.notSoGoodIf.map((x) => x.trim()) } : null;
}

export function parseQa(value: unknown, serializedJobData: string): QaOutput | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!text(item.answer, 900) || (item.status !== 'grounded' && item.status !== 'unknown') || !list(item.evidence) || item.evidence.length > 4 || item.evidence.some((item) => item.length > 120)) return null;
  const evidence = item.evidence.map((item) => item.trim());
  if (evidence.some((item) => !item || !serializedJobData.includes(item))) return null;
  const answer = item.answer.trim();
  const disclosure = /(not specified|not mentioned|not provided|not stated|unknown|not available|nicht angegeben|nicht genannt|nicht erwähnt|nicht spezifiziert|keine information|nicht ersichtlich|steht nicht)/i.test(answer);
  if (item.status === 'unknown' && !disclosure) return null;
  if (item.status === 'grounded' && (disclosure || evidence.length === 0)) return null;
  if (item.status === 'unknown' && evidence.length > 0) return null;
  return item.status === 'grounded'
    ? { answer, knownFromPosting: true, notSpecified: false, status: 'grounded', evidence }
    : { answer, knownFromPosting: false, notSpecified: true, status: 'unknown', evidence: [] };
}

const hasOnlyKeys = (item: Record<string, unknown>, keys: readonly string[]) => Object.keys(item).every((key) => keys.includes(key));
const hasEligibilityCertainty = (value: string) => /\b(?:you are|you're)\s+(?:definitely\s+|certainly\s+)?(?:eligible|qualified)\b|\b(?:du bist|sie sind)\s+(?:definitiv\s+|eindeutig\s+|sicher\s+)?(?:für\s+[^.]{1,60}\s+)?(?:geeignet|qualifiziert)\b|\b(?:guaranteed to be hired|will definitely be hired|wirst garantiert eingestellt)\b/i.test(value);
const parseBoundedList = (value: unknown, maxItems: number): string[] | null => {
  if (!Array.isArray(value) || value.length > maxItems || !value.every((item) => text(item, 420) && !hasEligibilityCertainty(item))) return null;
  return value.map((item) => item.trim());
};

export function parsePreparation(value: unknown): PreparationOutput | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!hasOnlyKeys(item, ['interviewQuestions', 'skillGap']) || !Array.isArray(item.interviewQuestions) || item.interviewQuestions.length < 3 || item.interviewQuestions.length > 5) return null;
  const interviewQuestions: PreparationQuestionOutput[] = [];
  for (const candidate of item.interviewQuestions) {
    if (!candidate || typeof candidate !== 'object') return null;
    const question = candidate as Record<string, unknown>;
    if (!hasOnlyKeys(question, ['question', 'whyAsked', 'answerTip']) || !text(question.question, 320) || !text(question.whyAsked, 420) || !text(question.answerTip, 520) || hasEligibilityCertainty(question.question) || hasEligibilityCertainty(question.whyAsked) || hasEligibilityCertainty(question.answerTip)) return null;
    interviewQuestions.push({ question: question.question.trim(), whyAsked: question.whyAsked.trim(), answerTip: question.answerTip.trim() });
  }
  if (!item.skillGap || typeof item.skillGap !== 'object') return null;
  const skillGap = item.skillGap as Record<string, unknown>;
  if (!hasOnlyKeys(skillGap, ['matches', 'gaps', 'positioningTips'])) return null;
  const matches = parseBoundedList(skillGap.matches, 8);
  const gaps = parseBoundedList(skillGap.gaps, 8);
  const positioningTips = parseBoundedList(skillGap.positioningTips, 6);
  return matches && gaps && positioningTips ? { interviewQuestions, skillGap: { matches, gaps, positioningTips } } : null;
}

export function validateLanguage(value: unknown): value is Language { return value === 'de' || value === 'en'; }
export function validateQuestion(value: unknown): value is string { return text(value, 300) && value.trim().length >= 3; }
export function validateBackground(value: unknown): value is string { return text(value, 2000) && value.trim().length >= 10; }

export function looksLikePromptInjection(question: string): boolean {
  return /(ignore|disregard|override|reveal|system prompt|developer message|instructions? above|pretend|act as|jailbreak)/i.test(question);
}
