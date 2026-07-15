import type { JobFilter } from '../types/jobs';
import { cleanJobDescription } from './job-presentation';
import { localizeCountry, t, type Locale } from './i18n';

type LocationContext = Pick<JobFilter, 'city' | 'country'>;
type CameraContext = JobFilter;

export function getDiscoveryLocationLabel(locale: Locale, context: LocationContext): string {
  const city = context.city?.trim();
  if (city) return city;

  const country = context.country?.trim();
  if (country) return localizeCountry(locale, country);

  return t(locale, 'discovery.location');
}

export function getMapCameraIntent(context: CameraContext): string {
  if (context.latitude !== undefined && context.longitude !== undefined) {
    return `coordinates:${context.latitude.toFixed(4)},${context.longitude.toFixed(4)}|radius:${context.radiusKm ?? 50}`;
  }

  const parts = [
    context.city?.trim() ? `city:${context.city.trim().toLowerCase()}` : null,
    context.country?.trim() ? `country:${context.country.trim().toLowerCase()}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join('|') : 'default';
}

export function shouldUpdateMapCamera(previousIntent: string | null, nextIntent: string, hasRegion: boolean): boolean {
  return hasRegion && previousIntent !== nextIntent;
}

export function prepareJobDescription(raw: string, collapseThreshold = 560): { text: string; collapsible: boolean } {
  const text = cleanJobDescription(raw);
  return { text, collapsible: text.length > collapseThreshold };
}
