import { useSyncExternalStore } from 'react';

export type Locale = 'de' | 'en';

const messages = {
  de: {
    'navigation.discovery': 'Entdecken',
    'navigation.favorites': 'Gespeichert',
    'navigation.jobDetails': 'Ausbildungsdetails',
    'location.permissionTitle': 'Standort verwenden?',
    'location.permissionDescription': 'Wir zeigen dir passende Ausbildungen in deiner Nähe.',
    'location.useLocation': 'Standort verwenden',
    'location.chooseLocation': 'Ort auswählen',
    'location.denied': 'Standortzugriff nicht erlaubt.',
    'location.fallback': 'Suche stattdessen nach Stadt oder Land.',
    'auth.loginRequired': 'Zum Speichern bitte anmelden.',
    'auth.login': 'Anmelden',
    'loading.jobs': 'Ausbildungen werden geladen …',
    'loading.jobDetails': 'Details werden geladen …',
    'loading.ai': 'KI-Antwort wird erstellt …',
    'errors.generic': 'Etwas ist schiefgelaufen.',
    'errors.jobs': 'Ausbildungen konnten nicht geladen werden.',
    'actions.save': 'Speichern',
    'actions.saved': 'Gespeichert',
    'actions.apply': 'Jetzt bewerben',
    'ai.explanation': 'Warum passt diese Ausbildung?',
    'ai.fitReasons': 'Das spricht für dich',
    'ai.considerations': 'Das solltest du beachten',
    'ai.askQuestion': 'Frage zur Ausbildung stellen',
    'ai.unknown': 'Dazu liegen keine verlässlichen Informationen vor.',
  },
  en: {
    'navigation.discovery': 'Discover',
    'navigation.favorites': 'Saved',
    'navigation.jobDetails': 'Apprenticeship details',
    'location.permissionTitle': 'Use your location?',
    'location.permissionDescription': 'We show apprenticeships near you.',
    'location.useLocation': 'Use location',
    'location.chooseLocation': 'Choose a location',
    'location.denied': 'Location access was denied.',
    'location.fallback': 'Search by city or country instead.',
    'auth.loginRequired': 'Please log in to save jobs.',
    'auth.login': 'Log in',
    'loading.jobs': 'Loading apprenticeships …',
    'loading.jobDetails': 'Loading details …',
    'loading.ai': 'Generating AI answer …',
    'errors.generic': 'Something went wrong.',
    'errors.jobs': 'Could not load apprenticeships.',
    'actions.save': 'Save',
    'actions.saved': 'Saved',
    'actions.apply': 'Apply now',
    'ai.explanation': 'Why might this fit you?',
    'ai.fitReasons': 'Reasons it may fit',
    'ai.considerations': 'Things to consider',
    'ai.askQuestion': 'Ask about this apprenticeship',
    'ai.unknown': 'There is no reliable information about this.',
  },
} as const;

export type TranslationKey = keyof typeof messages.en;

const localeMessages: Record<Locale, Record<TranslationKey, string>> = messages;

let currentLocale: Locale = 'de';
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  listeners.forEach((listener) => listener());
}

export function t(locale: Locale, key: TranslationKey): string {
  return localeMessages[locale][key];
}

export function useLocale(): readonly [Locale, (locale: Locale) => void] {
  const locale = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getLocale,
    getLocale,
  );

  return [locale, setLocale] as const;
}
