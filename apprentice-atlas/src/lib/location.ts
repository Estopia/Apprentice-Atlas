import type { JobFilter } from '../types/jobs';

export type ManualLocation = { city: string; country: string };

export function manualLocation(city: string, country: string): ManualLocation | null {
  const cleanCity = city.trim();
  const cleanCountry = country.trim();
  return cleanCity && cleanCountry ? { city: cleanCity, country: cleanCountry } : null;
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
