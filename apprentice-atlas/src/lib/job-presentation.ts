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
  text = text.replace(/^[\t ]{0,3}(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n[\t ]{0,3}\1[\t ]*$/gm, (_match, _fence: string, code: string) => protect(code));
  text = text.replace(/(`+)([^\n]*?)\1/g, (_match, _ticks: string, code: string) => protect(code));
  text = text.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_match, label: string, destination: string) => `${label} (${protect(destination)})`);
  text = text.replace(/https?:\/\/[^\s<>()]+/gi, (url) => protect(url));
  text = text.replace(/\\([`*_~])/g, (_match, delimiter: string) => protect(delimiter));
  // Python's common "dunder" names are identifiers, not Markdown emphasis.
  // Keep the allow-list deliberately narrow so ordinary __bold__ copy is still cleaned.
  text = text.replace(
    /(?<![\p{L}\p{N}_])__(?:init|name|main|file|doc|module|package|all|version|author|slots|dict|class|bases|mro|new|del|repr|str|bytes|format|hash|bool|len|iter|next|enter|exit|call|getattr|setattr|delattr|getitem|setitem|delitem|contains)__(?![\p{L}\p{N}_])/gu,
    (identifier) => protect(identifier),
  );
  text = text.split('\n').map((line) => {
    const heading = line.match(/^[\t ]{0,3}#{1,6}[\t ]+(.+)$/);
    let cleaned = heading ? heading[1].replace(/[\t ]+#{1,6}[\t ]*$/, '') : line;
    cleaned = cleaned.replace(/^[\t ]{0,3}(?:>[\t ]?)+/, '');
    cleaned = cleaned.replace(/^([\t ]*)[-*+][\t ]+/, '$1• ');
    return cleaned.replace(/[\t ]+$/, '');
  }).join('\n');

  text = text.replace(/(?<![\p{L}\p{N}])~~(?=\S)([^\n]*?\S)~~(?![\p{L}\p{N}])/gu, '$1');
  for (const markerLength of [3, 2, 1]) {
    const emphasis = new RegExp(`(?<![\\p{L}\\p{N}])(\\*{${markerLength}}|_{${markerLength}})(?=\\S)([^\\n]*?\\S)\\1(?![\\p{L}\\p{N}])`, 'gu');
    text = text.replace(emphasis, '$2');
  }

  text = text.trim();
  protectedSegments.forEach((segment, index) => {
    text = text.replaceAll(`\uE000${index}\uE001`, segment);
  });
  return text;
}
