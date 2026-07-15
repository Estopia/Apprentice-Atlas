export type NormalizedJobLevel = 'entry-level' | 'intermediate' | 'unknown';

export function normalizeJobLevel(level: unknown): NormalizedJobLevel {
  if (typeof level !== 'string') return 'unknown';

  const normalized = level.trim().toLowerCase();
  if (normalized === 'entry' || normalized === 'entry-level') return 'entry-level';
  if (normalized === 'intermediate') return 'intermediate';
  return 'unknown';
}

export function cleanJobDescription(raw: string): string {
  const protectedSegments: string[] = [];
  const protect = (value: string) => {
    const token = `\uE000${protectedSegments.length}\uE001`;
    protectedSegments.push(value);
    return token;
  };

  let text = raw.replace(/\r\n?/g, '\n');
  text = text.replace(/(`+)([^\n]*?)\1/g, (_match, _ticks: string, code: string) => protect(code));
  text = text.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_match, label: string, destination: string) => `${label} (${protect(destination)})`);
  text = text.split('\n').map((line) => {
    const heading = line.match(/^[\t ]{0,3}#{1,6}[\t ]+(.+)$/);
    let cleaned = heading ? heading[1].replace(/[\t ]+#{1,6}[\t ]*$/, '') : line;
    cleaned = cleaned.replace(/^[\t ]{0,3}(?:>[\t ]?)+/, '');
    cleaned = cleaned.replace(/^([\t ]*)[-*+][\t ]+/, '$1• ');
    return cleaned.replace(/[\t ]+$/, '');
  }).join('\n');

  for (const markerLength of [3, 2, 1]) {
    const emphasis = new RegExp(`(?<![\\p{L}\\p{N}])(\\*{${markerLength}}|_{${markerLength}})(?=\\S)([^\\n]*?\\S)\\1(?![\\p{L}\\p{N}])`, 'gu');
    text = text.replace(emphasis, '$2');
  }

  protectedSegments.forEach((segment, index) => {
    text = text.replaceAll(`\uE000${index}\uE001`, segment);
  });
  return text.trim();
}
