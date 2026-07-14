import type { JobFilter } from '../types/jobs';

export type ManualLocation = { city: string; country: string };

export function manualLocation(city: string, country: string): ManualLocation | null {
  const cleanCity = city.trim();
  const cleanCountry = canonicalCountry(country);
  return cleanCity && cleanCountry ? { city: cleanCity, country: cleanCountry } : null;
}

function canonicalCountry(country: string): string {
  const normalized = country.trim().toLocaleLowerCase('en');
  if (['de', 'deutschland', 'germany'].includes(normalized)) return 'Germany';
  if (['uk', 'gb', 'united kingdom', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'].includes(normalized)) return 'United Kingdom';
  return country.trim();
}

export function applyManualLocationFilters(filters: JobFilter, city: string, country: string): JobFilter | null {
  const selected = manualLocation(city, country);
  if (!selected) return null;
  const withoutDeviceRadius = { ...filters };
  delete withoutDeviceRadius.latitude;
  delete withoutDeviceRadius.longitude;
  delete withoutDeviceRadius.radiusKm;
  return { ...withoutDeviceRadius, city: selected.city, country: selected.country };
}

export function applyDeviceLocationFilters(filters: JobFilter, latitude: number, longitude: number): JobFilter {
  return { ...filters, city: undefined, country: undefined, latitude, longitude, radiusKm: filters.radiusKm ?? 50 };
}
