export type ManualLocation = { city: string; country: string };

export function manualLocation(city: string, country: string): ManualLocation | null {
  const cleanCity = city.trim();
  const cleanCountry = country.trim();
  return cleanCity && cleanCountry ? { city: cleanCity, country: cleanCountry } : null;
}
