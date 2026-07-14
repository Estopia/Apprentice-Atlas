import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Locale = 'de' | 'en';

const messages = {
  de: {
    'navigation.discovery': 'Entdecken',
    'navigation.favorites': 'Gespeichert',
    'navigation.jobDetails': 'Ausbildungsdetails',
    'discovery.title': 'Finde deine nächste Chance',
    'discovery.subtitle': 'Entdecke Ausbildungen und Einstiegsjobs in deiner Nähe.',
    'discovery.searchPlaceholder': 'Beruf oder Firma suchen',
    'discovery.results': 'Chancen gefunden',
    'discovery.refine': 'Suche verfeinern',
    'discovery.nearby': 'In deiner Nähe',
    'discovery.or': 'oder',
    'discovery.opportunityType': 'Art der Chance',
    'discovery.apprenticeship': 'Ausbildung',
    'discovery.entryLevel': 'Einstiegsjob',
    'discovery.level': 'Erfahrungslevel',
    'discovery.beginner': 'Für Einsteiger',
    'discovery.sort': 'Sortierung',
    'discovery.sortRecent': 'Neueste zuerst',
    'discovery.sortDistance': 'Nächste zuerst',
    'discovery.sortTitle': 'Titel A–Z',
    'discovery.resetFilters': 'Alle Filter zurücksetzen',
    'discovery.searchArea': 'Diesen Bereich durchsuchen',
    'discovery.nearbyShort': 'In der Nähe',
    'discovery.details': 'Details ansehen',
    'discovery.distanceNeedsLocation': 'Wähle zuerst deinen Standort oder einen Kartenausschnitt.',
    'discovery.jobs': 'Ausbildungen',
    'discovery.map': 'Karte',
    'discovery.list': 'Liste',
    'discovery.noResults': 'Keine passenden Ausbildungen gefunden.',
    'discovery.retry': 'Erneut versuchen',
    'discovery.location': 'Standort',
    'discovery.country': 'Land',
    'discovery.city': 'Stadt',
    'discovery.category': 'Kategorie',
    'category.technology': 'Technologie',
    'category.business': 'Wirtschaft',
    'category.skilled-trades': 'Handwerk',
    'discovery.distance': 'Entfernung',
    'discovery.all': 'Alle',
    'discovery.useManual': 'Stadt und Land verwenden',
    'discovery.markers': 'Kartenpositionen',
    'discovery.nationwide': 'Landesweit',
    'discovery.selectJob': 'Ausbildung auswählen',
    'discovery.loadingMap': 'Karte wird geladen …',
    'discovery.filters': 'Filter für Ausbildungen',
    'discovery.language': 'Sprache auswählen',
    'location.permissionTitle': 'Standort verwenden?',
    'location.permissionDescription': 'Wir zeigen dir passende Ausbildungen in deiner Nähe.',
    'location.useLocation': 'Standort verwenden',
    'location.chooseLocation': 'Ort auswählen',
    'location.denied': 'Standortzugriff nicht erlaubt.',
    'location.fallback': 'Suche stattdessen nach Stadt oder Land.',
    'auth.loginRequired': 'Zum Speichern bitte anmelden.',
    'auth.login': 'Anmelden',
    'auth.signup': 'Registrieren',
    'auth.title': 'Anmelden oder registrieren',
    'auth.account': 'Konto',
    'auth.description': 'Erstelle ein Konto, um Ausbildungen zu speichern und zu vergleichen.',
    'auth.email': 'E-Mail-Adresse',
    'auth.password': 'Passwort',
    'auth.form': 'Anmeldeformular',
    'auth.working': 'Wird verarbeitet …',
    'auth.confirmEmail': 'Prüfe deine E-Mail und bestätige dein Konto, bevor du dich anmeldest.',
    'auth.signOut': 'Abmelden',
    'auth.signingOut': 'Wird abgemeldet …',
    'loading.jobs': 'Ausbildungen werden geladen …',
    'loading.jobDetails': 'Details werden geladen …',
    'loading.ai': 'KI-Antwort wird erstellt …',
    'errors.generic': 'Etwas ist schiefgelaufen.',
    'errors.jobs': 'Ausbildungen konnten nicht geladen werden.',
    'errors.configuration': 'Die Suche ist gerade nicht verfügbar.',
    'errors.query': 'Ausbildungen konnten nicht geladen werden. Bitte versuche es erneut.',
    'errors.invalidLocation': 'Für die Entfernungssuche fehlt ein gültiger Standort.',
    'errors.jobNotFound': 'Diese Ausbildung ist nicht mehr verfügbar.',
    'errors.aiUnavailable': 'Die KI-Hilfe ist gerade nicht verfügbar. Die Originalanzeige bleibt vollständig lesbar.',
    'map.title': 'Kartenansicht',
    'map.webHelper': 'Web-Vorschau – wähle eine Kartenposition aus, um den Eintrag zu öffnen.',
    'map.noPositions': 'Keine Ausbildungen mit Kartenposition verfügbar.',
    'map.markerList': 'Liste der Kartenpositionen',
    'tabs.discover': 'Entdecken',
    'tabs.saved': 'Gespeichert',
    'saved.title': 'Gespeicherte Chancen',
    'saved.account': 'Konto',
    'saved.description': 'Melde dich an, um Ausbildungen für später zu speichern.',
    'saved.signIn': 'Anmelden',
    'saved.empty': 'Du hast noch keine Ausbildungen gespeichert.',
    'saved.remove': 'Entfernen',
    'saved.loading': 'Gespeicherte Ausbildungen werden geladen …',
    'saved.error': 'Gespeicherte Ausbildungen konnten nicht geladen werden.',
    'saved.errorConfiguration': 'Gespeicherte Ausbildungen sind gerade nicht verfügbar.',
    'saved.errorLoad': 'Gespeicherte Ausbildungen konnten nicht geladen werden.',
    'saved.errorSave': 'Ausbildung konnte nicht gespeichert werden.',
    'saved.errorRemove': 'Ausbildung konnte nicht entfernt werden.',
    'saved.unavailable': 'Nicht mehr verfügbar',
    'saved.archived': 'Archivierter Eintrag',
    'saved.compare': 'Vergleich',
    'saved.compareTitle': 'Titel',
    'saved.compareCompany': 'Unternehmen',
    'saved.compareLocation': 'Ort',
    'saved.compareType': 'Art',
    'actions.save': 'Speichern',
    'actions.saving': 'Wird gespeichert …',
    'actions.saved': 'Gespeichert',
    'actions.apply': 'Jetzt bewerben',
    'actions.back': 'Zurück',
    'actions.close': 'Schließen',
    'actions.done': 'Fertig',
    'actions.share': 'Teilen',
    'job.lastUpdated': 'Zuletzt aktualisiert',
    'job.description': 'Beschreibung',
    'job.requirements': 'Voraussetzungen',
    'job.openSource': 'Offizielle Quelle öffnen',
    'ai.explanation': 'Warum passt diese Ausbildung?',
    'ai.simpleWords': 'Einfach erklärt',
    'ai.goodIf': 'Das passt gut, wenn du …',
    'ai.notSoGoodIf': 'Weniger passend, wenn du …',
    'ai.fitReasons': 'Das spricht für dich',
    'ai.considerations': 'Das solltest du beachten',
    'ai.askQuestion': 'Frage zur Ausbildung stellen',
    'ai.unknown': 'Dazu liegen keine verlässlichen Informationen vor.',
    'ai.limitReached': 'Du hast bereits zwei Fragen gestellt.',
    'ai.questionPlaceholder': 'Zum Beispiel: Welche Voraussetzungen werden genannt?',
    'ai.ask': 'Frage senden',
  },
  en: {
    'navigation.discovery': 'Discover',
    'navigation.favorites': 'Saved',
    'navigation.jobDetails': 'Apprenticeship details',
    'discovery.title': 'Find your next opportunity',
    'discovery.subtitle': 'Discover apprenticeships and entry-level jobs near you.',
    'discovery.searchPlaceholder': 'Search roles or companies',
    'discovery.results': 'Opportunities found',
    'discovery.refine': 'Refine your search',
    'discovery.nearby': 'Near you',
    'discovery.or': 'or',
    'discovery.opportunityType': 'Opportunity type',
    'discovery.apprenticeship': 'Apprenticeship',
    'discovery.entryLevel': 'Entry-level job',
    'discovery.level': 'Experience level',
    'discovery.beginner': 'Beginner friendly',
    'discovery.sort': 'Sort order',
    'discovery.sortRecent': 'Newest first',
    'discovery.sortDistance': 'Nearest first',
    'discovery.sortTitle': 'Title A–Z',
    'discovery.resetFilters': 'Reset all filters',
    'discovery.searchArea': 'Search this area',
    'discovery.nearbyShort': 'Nearby',
    'discovery.details': 'View details',
    'discovery.distanceNeedsLocation': 'Choose your location or a map area first.',
    'discovery.jobs': 'Apprenticeships',
    'discovery.map': 'Map',
    'discovery.list': 'List',
    'discovery.noResults': 'No matching apprenticeships found.',
    'discovery.retry': 'Try again',
    'discovery.location': 'Location',
    'discovery.country': 'Country',
    'discovery.city': 'City',
    'discovery.category': 'Category',
    'category.technology': 'Technology',
    'category.business': 'Business',
    'category.skilled-trades': 'Skilled trades',
    'discovery.distance': 'Distance',
    'discovery.all': 'All',
    'discovery.useManual': 'Use city and country',
    'discovery.markers': 'Map positions',
    'discovery.nationwide': 'Nationwide',
    'discovery.selectJob': 'Select an apprenticeship',
    'discovery.loadingMap': 'Loading map …',
    'discovery.filters': 'Apprenticeship filters',
    'discovery.language': 'Choose language',
    'location.permissionTitle': 'Use your location?',
    'location.permissionDescription': 'We show apprenticeships near you.',
    'location.useLocation': 'Use location',
    'location.chooseLocation': 'Choose a location',
    'location.denied': 'Location access was denied.',
    'location.fallback': 'Search by city or country instead.',
    'auth.loginRequired': 'Please log in to save jobs.',
    'auth.login': 'Log in',
    'auth.signup': 'Create account',
    'auth.title': 'Log in or create an account',
    'auth.account': 'Account',
    'auth.description': 'Create an account to save and compare apprenticeships.',
    'auth.email': 'Email address',
    'auth.password': 'Password',
    'auth.form': 'Sign-in form',
    'auth.working': 'Working …',
    'auth.confirmEmail': 'Check your email and confirm your account before signing in.',
    'auth.signOut': 'Sign out',
    'auth.signingOut': 'Signing out …',
    'loading.jobs': 'Loading apprenticeships …',
    'loading.jobDetails': 'Loading details …',
    'loading.ai': 'Generating AI answer …',
    'errors.generic': 'Something went wrong.',
    'errors.jobs': 'Could not load apprenticeships.',
    'errors.configuration': 'Search is currently unavailable.',
    'errors.query': 'Could not load apprenticeships. Please try again.',
    'errors.invalidLocation': 'A valid location is needed for distance search.',
    'errors.jobNotFound': 'This apprenticeship is no longer available.',
    'errors.aiUnavailable': 'AI help is temporarily unavailable. The original listing remains fully available.',
    'map.title': 'Map preview',
    'map.webHelper': 'Web preview — select a map position to focus its listing.',
    'map.noPositions': 'No apprenticeships with map positions are available.',
    'map.markerList': 'Map marker list',
    'tabs.discover': 'Discover',
    'tabs.saved': 'Saved',
    'saved.title': 'Saved opportunities',
    'saved.account': 'Account',
    'saved.description': 'Sign in to keep apprenticeships here for later.',
    'saved.signIn': 'Log in',
    'saved.empty': 'You have not saved any apprenticeships yet.',
    'saved.remove': 'Remove',
    'saved.loading': 'Loading saved apprenticeships …',
    'saved.error': 'Could not load saved apprenticeships.',
    'saved.errorConfiguration': 'Saved apprenticeships are currently unavailable.',
    'saved.errorLoad': 'Could not load saved apprenticeships.',
    'saved.errorSave': 'Could not save this apprenticeship.',
    'saved.errorRemove': 'Could not remove this apprenticeship.',
    'saved.unavailable': 'No longer available',
    'saved.archived': 'Archived entry',
    'saved.compare': 'Compare',
    'saved.compareTitle': 'Title',
    'saved.compareCompany': 'Company',
    'saved.compareLocation': 'Location',
    'saved.compareType': 'Type',
    'actions.save': 'Save',
    'actions.saving': 'Saving …',
    'actions.saved': 'Saved',
    'actions.apply': 'Apply now',
    'actions.back': 'Back',
    'actions.close': 'Close',
    'actions.done': 'Done',
    'actions.share': 'Share',
    'job.lastUpdated': 'Last updated',
    'job.description': 'Description',
    'job.requirements': 'Requirements',
    'job.openSource': 'Open official source',
    'ai.explanation': 'Why might this fit you?',
    'ai.simpleWords': 'In simple words',
    'ai.goodIf': 'Good if you …',
    'ai.notSoGoodIf': 'Not so good if you …',
    'ai.fitReasons': 'Reasons it may fit',
    'ai.considerations': 'Things to consider',
    'ai.askQuestion': 'Ask about this apprenticeship',
    'ai.unknown': 'There is no reliable information about this.',
    'ai.limitReached': 'You have already asked two questions.',
    'ai.questionPlaceholder': 'For example: Which requirements are listed?',
    'ai.ask': 'Ask question',
  },
} as const;

export type TranslationKey = keyof typeof messages.en;

const localeMessages: Record<Locale, Record<TranslationKey, string>> = messages;

let currentLocale: Locale = 'de';
const listeners = new Set<() => void>();
export const LOCALE_STORAGE_KEY = 'apprentice-atlas.locale';

const isLocale = (value: string | null): value is Locale => value === 'de' || value === 'en';

export async function hydrateLocale(): Promise<Locale> {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored) && stored !== currentLocale) {
      currentLocale = stored;
      listeners.forEach((listener) => listener());
    }
  } catch {
    // DE is the intentional fallback when platform storage is unavailable.
  }
  return currentLocale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  listeners.forEach((listener) => listener());
  void AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale).catch(() => undefined);
}

export function t(locale: Locale, key: TranslationKey): string {
  return localeMessages[locale][key];
}

export function localizeCategory(locale: Locale, category: string): string {
  const key = `category.${category}` as TranslationKey;
  return key in localeMessages[locale] ? t(locale, key) : category;
}

export function localizeJobType(locale: Locale, jobType: string): string {
  if (jobType === 'apprenticeship') return t(locale, 'discovery.apprenticeship');
  if (jobType === 'entry-level') return t(locale, 'discovery.entryLevel');
  return jobType;
}

export function localizeJobLevel(locale: Locale, level: string): string {
  if (level === 'entry') return t(locale, 'discovery.beginner');
  return level;
}

export function localizeCountry(locale: Locale, country: string): string {
  if (locale === 'de' && country === 'Germany') return 'Deutschland';
  if (locale === 'de' && country === 'United Kingdom') return 'Vereinigtes Königreich';
  return country;
}

export function localizeJobError(locale: Locale, code: 'configuration' | 'query' | 'invalid-filter'): string {
  return t(locale, code === 'configuration' ? 'errors.configuration' : code === 'invalid-filter' ? 'errors.invalidLocation' : 'errors.query');
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
