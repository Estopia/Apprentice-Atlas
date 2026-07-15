import type { Locale } from './i18n';

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

export type ShareableJob = {
  id: string;
  title: string;
  company: string;
  city: string;
  country: string;
  sourceName: string;
};

export type JobShareCopy = {
  title: string;
  location: string;
  sourceAttribution: string;
  deepLink: string;
  message: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isShareableJobId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function buildJobDeepLink(jobId: string): string | null {
  return isShareableJobId(jobId) ? `apprenticeatlas://job/${jobId.toLowerCase()}` : null;
}

export function buildJobShareCopy({ job, locale }: { job: ShareableJob; locale: Locale }): JobShareCopy | null {
  const deepLink = buildJobDeepLink(job.id);
  if (!deepLink) return null;
  const title = normalizeShareLine(job.title);
  const company = normalizeShareLine(job.company);
  const city = normalizeShareLine(job.city);
  const country = localizeShareCountry(locale, normalizeShareLine(job.country));
  const sourceName = normalizeShareLine(job.sourceName);
  const location = [city, country].filter(Boolean).join(', ');
  const sourceAttribution = `${locale === 'de' ? 'Quelle' : 'Source'}: ${sourceName}`;
  const roleLine = locale === 'de' ? `${title} bei ${company}` : `${title} at ${company}`;
  const footer = locale === 'de' ? 'Geteilt mit Apprentice Atlas' : 'Shared with Apprentice Atlas';

  return {
    title,
    location,
    sourceAttribution,
    deepLink,
    message: `${roleLine}\n${location}\n${sourceAttribution}\n${deepLink}\n\n${footer}`,
  };
}

function normalizeShareLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim();
}

function localizeShareCountry(locale: Locale, country: string): string {
  if (locale === 'de' && country === 'Germany') return 'Deutschland';
  if (locale === 'de' && country === 'United Kingdom') return 'Vereinigtes Königreich';
  return country;
}
