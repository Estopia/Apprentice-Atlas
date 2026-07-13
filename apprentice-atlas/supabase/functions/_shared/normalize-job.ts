import type { Job } from '../../../src/types/jobs.ts';
import type { NormalizedSourceRecord, SourceRecord } from './source-adapter.ts';
import { asString, firstString } from './source-adapter.ts';

export type CanonicalJob = Job;

export interface NormalizeOptions {
  provider: string;
  defaultCountry?: string;
  defaultJobType?: string;
  defaultLevel?: string;
  defaultCategory?: string;
}

const textList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(asString).filter((item): item is string => item !== null);
  const text = asString(value);
  return text ? text.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean) : [];
};

const numberValue = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  return Number.isFinite(number) ? number : null;
};

const pickNested = (record: SourceRecord, keys: string[]): string | null => {
  for (const key of keys) {
    const value = record[key];
    const text = asString(value);
    if (text) return text;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = firstString(value as SourceRecord, ['name', 'label', 'value', 'city', 'town']);
      if (nested) return nested;
    }
  }
  return null;
};

export function normalizeJob(record: SourceRecord, options: NormalizeOptions): NormalizedSourceRecord | null {
  const externalId = firstString(record, ['externalId', 'external_id', 'id', 'vacancyId', 'vacancyReferenceNumber', 'reference']);
  const sourceUrl = firstString(record, ['sourceUrl', 'source_url', 'url', 'vacancyUrl', 'applicationUri', 'applicationUrl']);
  const title = firstString(record, ['title', 'jobTitle', 'vacancyTitle']);
  const company = pickNested(record, ['company', 'employer', 'employerName', 'organisation', 'organization']);
  const location = record.location && typeof record.location === 'object' ? record.location as SourceRecord : {};
  const city = pickNested(record, ['city', 'town', 'locationCity', 'locationName']) ?? pickNested(location, ['city', 'town', 'name']);
  const country = pickNested(record, ['country', 'countryName', 'locationCountry']) ?? pickNested(location, ['country', 'countryName']);
  const latitude = numberValue(record.latitude ?? record.lat ?? location.latitude ?? location.lat);
  const longitude = numberValue(record.longitude ?? record.lng ?? record.lon ?? location.longitude ?? location.lng ?? location.lon);
  const usableLocation = Boolean(city || country || (latitude !== null && longitude !== null));
  if (!externalId || !sourceUrl || !title || !company || !usableLocation) return null;

  const now = new Date().toISOString();
  const normalizedCountry = country ?? options.defaultCountry ?? 'Unknown';
  const normalizedCity = city ?? (latitude !== null && longitude !== null ? 'Unknown' : null);
  if (!normalizedCity) return null;
  const description = firstString(record, ['rawDescription', 'description', 'shortDescription', 'displayText']) ?? '';
  const expiresAt = firstString(record, ['expiresAt', 'expiryDate', 'closingDate']);
  const job: CanonicalJob = {
    id: crypto.randomUUID(),
    title,
    company,
    country: normalizedCountry,
    city: normalizedCity,
    latitude: latitude !== null && latitude >= -90 && latitude <= 90 ? latitude : null,
    longitude: longitude !== null && longitude >= -180 && longitude <= 180 ? longitude : null,
    jobType: firstString(record, ['jobType', 'type', 'employmentType']) ?? options.defaultJobType ?? 'apprenticeship',
    level: firstString(record, ['level', 'educationLevel']) ?? options.defaultLevel ?? 'entry-level',
    category: firstString(record, ['category', 'sector', 'occupation']) ?? options.defaultCategory ?? 'general',
    tags: textList(record.tags ?? record.keywords),
    rawDescription: description,
    requirements: textList(record.requirements ?? record.skills),
    sourceUrl,
    sourceName: options.provider,
    status: 'active',
    lastSeenAt: now,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };
  return { externalId, sourceUrl, job, rawRecord: record };
}

