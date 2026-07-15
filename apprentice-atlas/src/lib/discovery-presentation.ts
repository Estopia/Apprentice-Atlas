import type { JobFilter } from '../types/jobs';
import { cleanJobDescription } from './job-presentation';
import { localizeCountry, t, type Locale } from './i18n';

type LocationContext = Pick<JobFilter, 'city' | 'country'>;
type CameraContext = JobFilter;
type AccessibleJob = { title: string; company: string; city: string; country: string };

export type MapCameraSyncState = {
  observedIntent: string | null;
  appliedIntent: string | null;
  pendingIntent: string | null;
  pendingResultIdentity: string | null;
  sawLoading: boolean;
};

export type MapCameraSyncInput = {
  intent: string;
  resultIdentity: string | null;
  loading: boolean;
};

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

export function decideMapCameraSync(
  state: MapCameraSyncState,
  input: MapCameraSyncInput,
): { state: MapCameraSyncState; apply: boolean } {
  if (state.observedIntent === null) {
    if (!input.loading && input.resultIdentity) {
      return {
        state: { observedIntent: input.intent, appliedIntent: input.intent, pendingIntent: null, pendingResultIdentity: null, sawLoading: false },
        apply: true,
      };
    }
    return {
      state: {
        observedIntent: input.intent,
        appliedIntent: null,
        pendingIntent: input.intent,
        pendingResultIdentity: input.resultIdentity,
        sawLoading: input.loading,
      },
      apply: false,
    };
  }

  if (state.observedIntent !== input.intent) {
    return {
      state: {
        ...state,
        observedIntent: input.intent,
        pendingIntent: input.intent,
        pendingResultIdentity: input.resultIdentity,
        sawLoading: input.loading,
      },
      apply: false,
    };
  }

  if (state.pendingIntent === input.intent) {
    const sawLoading = state.sawLoading || input.loading;
    const resultChanged = Boolean(input.resultIdentity && input.resultIdentity !== state.pendingResultIdentity);
    if (!input.loading && input.resultIdentity && (sawLoading || resultChanged)) {
      return {
        state: { observedIntent: input.intent, appliedIntent: input.intent, pendingIntent: null, pendingResultIdentity: null, sawLoading: false },
        apply: true,
      };
    }
    return { state: { ...state, sawLoading }, apply: false };
  }

  return { state, apply: false };
}

export function getJobAccessibilityLabel(locale: Locale, job: AccessibleJob): string {
  return `${job.title}, ${job.company}, ${job.city}, ${localizeCountry(locale, job.country)}`;
}

export function prepareJobDescription(raw: string, collapseThreshold = 180): { text: string; collapsible: boolean } {
  const text = cleanJobDescription(raw);
  return { text, collapsible: text.length > collapseThreshold };
}

export function getDescriptionLineLimit(collapsible: boolean, expanded: boolean): 8 | undefined {
  return collapsible && !expanded ? 8 : undefined;
}
