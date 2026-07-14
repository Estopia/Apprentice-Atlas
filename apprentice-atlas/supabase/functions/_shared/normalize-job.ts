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

const coordinatePair = (record: SourceRecord): { latitude: number; longitude: number } | null | 'invalid' => {
  const candidates: SourceRecord[] = [record];
  if (Array.isArray(record.addresses)) {
    for (const address of record.addresses) {
      if (address && typeof address === 'object' && !Array.isArray(address)) {
        const item = address as SourceRecord;
        candidates.push(item);
        if (item.address && typeof item.address === 'object' && !Array.isArray(item.address)) candidates.push(item.address as SourceRecord);
      }
    }
  }
  let sawCoordinate = false;
  for (const candidate of candidates) {
    const rawLatitude = candidate.latitude ?? candidate.lat;
    const rawLongitude = candidate.longitude ?? candidate.lng ?? candidate.lon;
    if (rawLatitude !== undefined || rawLongitude !== undefined) sawCoordinate = true;
    const latitude = numberValue(rawLatitude);
    const longitude = numberValue(rawLongitude);
    if (latitude !== null && longitude !== null && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
      return { latitude, longitude };
    }
  }
  return sawCoordinate ? 'invalid' : null;
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
  const externalId = firstString(record, ['externalId', 'external_id', 'id', 'vacancyId', 'vacancyReference', 'vacancyReferenceNumber', 'reference']);
  const sourceUrl = firstString(record, ['vacancyUrl', 'sourceUrl', 'source_url', 'url', 'applicationUri', 'applicationUrl']);
  const applicationUrl = firstString(record, ['applicationUrl', 'applicationUri', 'applyUrl', 'apply_url']);
  const title = firstString(record, ['title', 'jobTitle', 'vacancyTitle']);
  const company = pickNested(record, ['company', 'employer', 'employerName', 'organisation', 'organization']);
  const firstAddress = Array.isArray(record.addresses) && record.addresses[0] && typeof record.addresses[0] === 'object'
    ? record.addresses[0] as SourceRecord
    : {};
  const nestedAddress = firstAddress.address && typeof firstAddress.address === 'object' && !Array.isArray(firstAddress.address)
    ? firstAddress.address as SourceRecord
    : {};
  const city = pickNested(record, ['city', 'town', 'locationCity', 'locationName'])
    ?? pickNested(firstAddress, ['city', 'town', 'locationName'])
    ?? pickNested(nestedAddress, ['city', 'town', 'locality', 'postcode']);
  const country = pickNested(record, ['country', 'countryName', 'locationCountry'])
    ?? pickNested(firstAddress, ['country', 'countryName'])
    ?? pickNested(nestedAddress, ['country', 'countryName']);
  const coordinates = coordinatePair(record);
  if (!externalId || !sourceUrl || !title || !company || coordinates === 'invalid') return null;

  const now = new Date().toISOString();
  const normalizedCountry = country ?? options.defaultCountry ?? 'Unknown';
  const normalizedCity = city ?? 'Unknown';
  const description = firstString(record, ['rawDescription', 'description', 'shortDescription', 'displayText']) ?? '';
  const expiresAt = firstString(record, ['expiresAt', 'expiryDate', 'closingDate']);
  const job: CanonicalJob = {
    id: crypto.randomUUID(),
    title,
    company,
    country: normalizedCountry,
    city: normalizedCity,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    jobType: firstString(record, ['jobType', 'type', 'employmentType']) ?? options.defaultJobType ?? 'apprenticeship',
    level: firstString(record, ['level', 'educationLevel']) ?? options.defaultLevel ?? 'entry-level',
    category: firstString(record, ['category', 'sector', 'occupation']) ?? options.defaultCategory ?? 'general',
    tags: textList(record.tags ?? record.keywords),
    rawDescription: description,
    requirements: textList(record.requirements ?? record.skills),
    sourceUrl,
    applicationUrl,
    sourceName: options.provider,
    status: 'active',
    lastSeenAt: now,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };
  return { externalId, sourceUrl, job, rawRecord: record };
}
