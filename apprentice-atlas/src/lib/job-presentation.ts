export type NormalizedJobLevel = 'entry-level' | 'intermediate' | 'unknown';

export function normalizeJobLevel(level: unknown): NormalizedJobLevel {
  if (typeof level !== 'string') return 'unknown';

  const normalized = level.trim().toLowerCase();
  if (normalized === 'entry' || normalized === 'entry-level') return 'entry-level';
  if (normalized === 'intermediate') return 'intermediate';
  return 'unknown';
}

export function cleanJobDescription(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/^[\t ]*[-*+][\t ]+/gm, '• ')
    .replace(/(\*\*|__)(?=\S)([^\n]*?\S)\1/g, '$2')
    .replace(/([*_])(?=\S)([^\n]*?\S)\1/g, '$2')
    .replace(/[\t ]+$/gm, '')
    .trim();
}
