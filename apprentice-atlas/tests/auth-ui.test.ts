import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const storedProfiles = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storedProfiles.get(key) ?? null,
    setItem: async (key: string, value: string) => { storedProfiles.set(key, value); },
    removeItem: async (key: string) => { storedProfiles.delete(key); },
  },
}));

import { isSafeReturnPath } from '../src/lib/auth';
import {
  deleteCareerProfile,
  getPreparationScopedState,
  isPreparationRequestCurrent,
  loadCareerProfile,
  saveCareerProfile,
} from '../src/lib/career-profile';
import { t } from '../src/lib/i18n';

const authForm = readFileSync(new URL('../src/components/auth/auth-form.tsx', import.meta.url), 'utf8');
const authScreen = readFileSync(new URL('../src/app/auth.tsx', import.meta.url), 'utf8');
const appConfig = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const prepareScreen = readFileSync(new URL('../src/app/prepare/[jobId].tsx', import.meta.url), 'utf8');
const rootLayout = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');
const jobDetail = readFileSync(new URL('../src/app/job/[id].tsx', import.meta.url), 'utf8');
const atlasScreen = readFileSync(new URL('../src/app/(tabs)/atlas.tsx', import.meta.url), 'utf8');
const jobId = '11111111-1111-4111-8111-111111111111';

describe('native auth and onboarding configuration', () => {
  it('uses the native Apple button and has no Google or password control', () => {
    expect(authForm).toContain('AppleAuthentication.AppleAuthenticationButton');
    expect(authForm).toContain('AppleAuthenticationButtonStyle.BLACK');
    expect(authForm).toContain('accessibilityState={appleControl.accessibilityState}');
    expect(authForm).toContain('appleControl.announceLoading');
    expect(authForm).not.toMatch(/Google/i);
    expect(authForm).not.toContain('secureTextEntry');
  });

  it('asks for language and search country before audience and interests', () => {
    const onboarding = readFileSync(new URL('../src/app/onboarding.tsx', import.meta.url), 'utf8');
    const languageStep = onboarding.indexOf("{step === 0 && (");
    const audienceStep = onboarding.indexOf("{step === 1 && (");
    const interestsStep = onboarding.indexOf("{step === 2 && (");

    expect(onboarding.slice(languageStep, audienceStep)).toContain('onboarding.countryLanguageTitle');
    expect(onboarding.slice(languageStep, audienceStep)).toContain('onboarding.language');
    expect(onboarding.slice(audienceStep, interestsStep)).toContain('onboarding.audienceTitle');
    expect(onboarding.slice(interestsStep)).toContain('onboarding.interestsTitle');
  });

  it('enables the native Sign in with Apple entitlement and config plugin', () => {
    expect(appConfig.expo.ios.usesAppleSignIn).toBe(true);
    expect(appConfig.expo.plugins).toContain('expo-apple-authentication');
  });

  it('awaits async Apple completion and passes the continuation directly', () => {
    expect(authForm).toContain('onSuccess: (userId: string) => void | Promise<void>');
    expect(authForm).toContain('await onSuccess(result.data.user.id)');
    expect(authScreen).toContain('onSuccess={complete}');
    expect(authScreen).not.toContain('onSuccess={() => void complete()}');
  });

  it('wires step-specific reset keys to both onboarding scroll modes', () => {
    const onboarding = readFileSync(new URL('../src/app/onboarding.tsx', import.meta.url), 'utf8');
    expect(onboarding).toContain("key={getOnboardingScrollKey('whole-page-scroll', step)}");
    expect(onboarding).toContain("key={getOnboardingScrollKey('contained', step)}");
  });

  it('allows only UUID-scoped preparation routes as safe auth return paths', () => {
    expect(isSafeReturnPath(`/prepare/${jobId}`)).toBe(true);
    expect(isSafeReturnPath('/prepare/not-a-uuid')).toBe(false);
    expect(isSafeReturnPath(`/prepare/${jobId}/extra`)).toBe(false);
    expect(isSafeReturnPath(`https://evil.test/prepare/${jobId}`)).toBe(false);
  });

  it('keeps each authenticated user career profile device-local', async () => {
    storedProfiles.clear();
    await saveCareerProfile('user-1', '  HTML, teamwork, and a school project.  ');
    expect(await loadCareerProfile('user-1')).toBe('HTML, teamwork, and a school project.');
    expect(await loadCareerProfile('user-2')).toBe('');
  });

  it('deletes only the requested user career-profile key', async () => {
    storedProfiles.clear();
    await saveCareerProfile('user-1', 'Private profile one');
    await saveCareerProfile('user-2', 'Private profile two');

    await deleteCareerProfile('user-1');

    expect(await loadCareerProfile('user-1')).toBe('');
    expect(await loadCareerProfile('user-2')).toBe('Private profile two');
    expect(storedProfiles.has('apprentice-atlas:career-profile:user-1')).toBe(false);
  });

  it('retries a transient local career-profile deletion failure', async () => {
    const removeItem = vi.fn()
      .mockRejectedValueOnce(new Error('temporary storage failure'))
      .mockResolvedValueOnce(undefined);
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem };

    await expect(deleteCareerProfile('user-1', storage)).resolves.toBeUndefined();
    expect(removeItem).toHaveBeenCalledTimes(2);
    expect(removeItem).toHaveBeenNthCalledWith(1, 'apprentice-atlas:career-profile:user-1');
    expect(removeItem).toHaveBeenNthCalledWith(2, 'apprentice-atlas:career-profile:user-1');
  });

  it('clears personalized preparation state when identity, job, or locale changes', () => {
    const userOneState = {
      userId: 'user-1',
      jobId,
      locale: 'en',
      background: 'Private background for user one',
      result: { interviewQuestions: ['private result'] },
      error: 'Private error for user one',
      saveError: true,
      generating: true,
    };

    expect(getPreparationScopedState(userOneState, { userId: 'user-1', jobId, locale: 'en' })).toBe(userOneState);
    expect(getPreparationScopedState(userOneState, { userId: 'user-2', jobId, locale: 'en' })).toEqual({
      userId: 'user-2',
      jobId,
      locale: 'en',
      background: '',
      result: null,
      error: null,
      saveError: false,
      generating: false,
    });
    expect(getPreparationScopedState(userOneState, { userId: 'user-1', jobId: '33333333-3333-4333-8333-333333333333', locale: 'en' })).toMatchObject({
      background: userOneState.background, result: null, error: null, generating: false,
    });
    expect(getPreparationScopedState(userOneState, { userId: 'user-1', jobId, locale: 'de' })).toMatchObject({
      background: userOneState.background, result: null, error: null, generating: false,
    });
    const firstVisit = { ...userOneState, scopeId: {} };
    expect(getPreparationScopedState(firstVisit, { userId: 'user-1', jobId, locale: 'en', scopeId: {} })).toMatchObject({
      background: userOneState.background, result: null, error: null, generating: false,
    });
    expect(prepareScreen).toContain('getPreparationScopedState(personalState, preparationScope)');
  });

  it('rejects completed requests after request, profile, identity, locale, or job changes', () => {
    const request = { requestId: 7, userId: 'user-1', jobId, locale: 'en', background: 'Current profile' };
    expect(isPreparationRequestCurrent(request, request)).toBe(true);
    expect(isPreparationRequestCurrent(request, { ...request, requestId: 8 })).toBe(false);
    expect(isPreparationRequestCurrent(request, { ...request, background: 'Edited profile' })).toBe(false);
    expect(isPreparationRequestCurrent(request, { ...request, userId: 'user-2' })).toBe(false);
    expect(isPreparationRequestCurrent(request, { ...request, locale: 'de' })).toBe(false);
    expect(isPreparationRequestCurrent(request, { ...request, jobId: '33333333-3333-4333-8333-333333333333' })).toBe(false);
    expect(prepareScreen).toContain('isPreparationRequestCurrent(requestSnapshot, latestRequestRef.current)');
  });

  it('provides a dedicated authenticated preparation route with complete native states', () => {
    expect(rootLayout).toContain('<Stack.Screen name="prepare/[jobId]"');
    expect(prepareScreen).toContain('useAuth()');
    expect(prepareScreen).toContain('prepareForJob(');
    expect(prepareScreen).toContain('saveCareerProfile(');
    expect(prepareScreen).toContain('ActivityIndicator');
    expect(prepareScreen).toContain('accessibilityRole="alert"');
    expect(prepareScreen).toContain('prepare.emptyTitle');
    expect(prepareScreen).toContain('prepare.matchesTitle');
    expect(prepareScreen).toContain('prepare.gapsTitle');
    expect(prepareScreen).toContain('prepare.positioningTitle');
    expect(prepareScreen).toContain('prepare.uncertainty');
    expect(prepareScreen).toContain('accessibilityState={{ disabled: generateDisabled, busy: generating }}');
  });

  it('routes job detail and interview next actions directly to preparation', () => {
    expect(jobDetail).toContain("pathname: '/prepare/[jobId]'");
    expect(jobDetail).toContain('returnTo: `/prepare/${job.id}`');
    expect(atlasScreen).toContain("nextAction.kind === 'prepare-interview'");
    expect(atlasScreen).toContain("pathname: '/prepare/[jobId]'");
    expect(jobDetail).not.toMatch(/pathname: '\/prepare\/\[jobId\]'[\s\S]{0,100}as never/);
    expect(atlasScreen).not.toMatch(/pathname: '\/prepare\/\[jobId\]'[\s\S]{0,100}as never/);
  });

  it('has matching German and English preparation copy', () => {
    const keys = [
      'prepare.title', 'prepare.backgroundLabel', 'prepare.generate', 'prepare.matchesTitle',
      'prepare.gapsTitle', 'prepare.positioningTitle', 'prepare.uncertainty', 'prepare.error',
    ] as const;
    for (const key of keys) {
      expect(t('de', key)).toBeTruthy();
      expect(t('en', key)).toBeTruthy();
      expect(t('de', key)).not.toBe(t('en', key));
    }

    const germanPrivacy = t('de', 'prepare.privateNote');
    expect(germanPrivacy).toContain('Supabase-Funktion');
    expect(germanPrivacy).toContain('OpenAI');
    expect(germanPrivacy).toContain('Analyse');
    expect(germanPrivacy).toContain('gemeinsamen Job-Cache');

    const englishPrivacy = t('en', 'prepare.privateNote');
    expect(englishPrivacy).toContain('Supabase function');
    expect(englishPrivacy).toContain('OpenAI');
    expect(englishPrivacy).toContain('analysis');
    expect(englishPrivacy).toContain('shared job cache');
  });
});
