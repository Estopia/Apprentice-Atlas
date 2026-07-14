import { useSyncExternalStore } from 'react';

export type Locale = 'de' | 'en';

const messages = {
  de: {
    'navigation.discovery': 'Entdecken',
    'navigation.favorites': 'Gespeichert',
    'navigation.jobDetails': 'Ausbildungsdetails',
    'discovery.title': 'Finde deine nächste Chance',
    'discovery.subtitle': 'Entdecke Ausbildungen und Einstiegsjobs in deiner Nähe.',
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
    'auth.description': 'Erstelle ein Konto, um Ausbildungen zu speichern und zu vergleichen.',
    'auth.email': 'E-Mail-Adresse',
    'auth.password': 'Passwort',
    'auth.form': 'Anmeldeformular',
    'auth.working': 'Wird verarbeitet …',
    'auth.confirmEmail': 'Prüfe deine E-Mail und bestätige dein Konto, bevor du dich anmeldest.',
    'loading.jobs': 'Ausbildungen werden geladen …',
    'loading.jobDetails': 'Details werden geladen …',
    'loading.ai': 'KI-Antwort wird erstellt …',
    'errors.generic': 'Etwas ist schiefgelaufen.',
    'errors.jobs': 'Ausbildungen konnten nicht geladen werden.',
    'errors.configuration': 'Die Suche ist gerade nicht verfügbar.',
    'errors.query': 'Ausbildungen konnten nicht geladen werden. Bitte versuche es erneut.',
    'errors.invalidLocation': 'Für die Entfernungssuche fehlt ein gültiger Standort.',
    'errors.jobNotFound': 'Diese Ausbildung ist nicht mehr verfügbar.',
    'map.title': 'Kartenansicht',
    'map.webHelper': 'Web-Vorschau – wähle eine Kartenposition aus, um den Eintrag zu öffnen.',
    'map.noPositions': 'Keine Ausbildungen mit Kartenposition verfügbar.',
    'map.markerList': 'Liste der Kartenpositionen',
    'tabs.discover': 'Entdecken',
    'tabs.saved': 'Gespeichert',
    'saved.title': 'Gespeicherte Chancen',
    'saved.description': 'Melde dich an, um Ausbildungen für später zu speichern.',
    'saved.signIn': 'Anmelden',
    'saved.empty': 'Du hast noch keine Ausbildungen gespeichert.',
    'saved.remove': 'Entfernen',
    'saved.loading': 'Gespeicherte Ausbildungen werden geladen …',
    'saved.error': 'Gespeicherte Ausbildungen konnten nicht geladen werden.',
    'saved.unavailable': 'Nicht mehr verfügbar',
    'saved.compare': 'Vergleich',
    'actions.save': 'Speichern',
    'actions.saved': 'Gespeichert',
    'actions.apply': 'Jetzt bewerben',
    'actions.back': 'Zurück',
    'job.lastUpdated': 'Zuletzt aktualisiert',
    'job.description': 'Beschreibung',
    'job.requirements': 'Voraussetzungen',
    'job.openSource': 'Offizielle Quelle öffnen',
    'ai.explanation': 'Warum passt diese Ausbildung?',
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
    'auth.description': 'Create an account to save and compare apprenticeships.',
    'auth.email': 'Email address',
    'auth.password': 'Password',
    'auth.form': 'Sign-in form',
    'auth.working': 'Working …',
    'auth.confirmEmail': 'Check your email and confirm your account before signing in.',
    'loading.jobs': 'Loading apprenticeships …',
    'loading.jobDetails': 'Loading details …',
    'loading.ai': 'Generating AI answer …',
    'errors.generic': 'Something went wrong.',
    'errors.jobs': 'Could not load apprenticeships.',
    'errors.configuration': 'Search is currently unavailable.',
    'errors.query': 'Could not load apprenticeships. Please try again.',
    'errors.invalidLocation': 'A valid location is needed for distance search.',
    'errors.jobNotFound': 'This apprenticeship is no longer available.',
    'map.title': 'Map preview',
    'map.webHelper': 'Web preview — select a map position to focus its listing.',
    'map.noPositions': 'No apprenticeships with map positions are available.',
    'map.markerList': 'Map marker list',
    'tabs.discover': 'Discover',
    'tabs.saved': 'Saved',
    'saved.title': 'Saved opportunities',
    'saved.description': 'Sign in to keep apprenticeships here for later.',
    'saved.signIn': 'Log in',
    'saved.empty': 'You have not saved any apprenticeships yet.',
    'saved.remove': 'Remove',
    'saved.loading': 'Loading saved apprenticeships …',
    'saved.error': 'Could not load saved apprenticeships.',
    'saved.unavailable': 'No longer available',
    'saved.compare': 'Compare',
    'actions.save': 'Save',
    'actions.saved': 'Saved',
    'actions.apply': 'Apply now',
    'actions.back': 'Back',
    'job.lastUpdated': 'Last updated',
    'job.description': 'Description',
    'job.requirements': 'Requirements',
    'job.openSource': 'Open official source',
    'ai.explanation': 'Why might this fit you?',
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

export function localizeCategory(locale: Locale, category: string): string {
  const key = `category.${category}` as TranslationKey;
  return key in localeMessages[locale] ? t(locale, key) : category;
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
