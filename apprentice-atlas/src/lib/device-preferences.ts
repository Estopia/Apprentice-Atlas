export type DeviceLocale = {
  languageCode?: string | null;
  languageTag?: string;
  regionCode?: string | null;
};

export type FirstRunDeviceDefaults = {
  locale: 'de' | 'en';
  country: 'Germany' | 'United Kingdom' | null;
};

export function getFirstRunDeviceDefaults(locales: readonly DeviceLocale[]): FirstRunDeviceDefaults {
  const primary = locales[0];
  const tagParts = primary?.languageTag?.replace('_', '-').split('-') ?? [];
  const languageCode = (primary?.languageCode ?? tagParts[0] ?? '').toLowerCase();
  const regionCode = (primary?.regionCode ?? tagParts.find((part) => part.length === 2 && part !== languageCode) ?? '').toUpperCase();

  const locale = languageCode === 'de'
    ? 'de'
    : languageCode === 'en'
      ? 'en'
      : regionCode === 'DE'
        ? 'de'
        : 'en';

  const country = regionCode === 'DE'
    ? 'Germany'
    : regionCode === 'GB' || regionCode === 'UK'
      ? 'United Kingdom'
      : null;

  return { locale, country };
}
