const BRAND_PALETTE = [
  ['#155EEF', '#EAF1FF'],
  ['#0B7A75', '#E4F5F3'],
  ['#A23E48', '#FBEAEC'],
  ['#7A4E00', '#FFF2D6'],
  ['#5B3FB5', '#EFEAFE'],
  ['#2E6B3A', '#E8F4EA'],
] as const;

const LEGAL_WORDS = new Set(['gmbh', 'kg', 'ag', 'ltd', 'limited', 'inc', 'co', 'plc', 'mbh', 'ug']);

function normalized(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function companyHash(company: string): number {
  let hash = 0;
  for (const character of normalized(company)) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

export function getCompanyInitials(company: string): string {
  const words = normalized(company).split(' ').filter((word) => word && !LEGAL_WORDS.has(word));
  return (words.slice(0, 2).map((word) => word[0]).join('') || '?').toUpperCase();
}

export function getCompanyBrand(company: string) {
  const [accent, soft] = BRAND_PALETTE[companyHash(company) % BRAND_PALETTE.length];
  return {
    accent,
    initials: getCompanyInitials(company),
    soft,
  };
}
