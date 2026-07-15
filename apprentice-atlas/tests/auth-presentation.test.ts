import { describe, expect, it, vi } from 'vitest';

import {
  getEmailSubmissionState,
  submitEmailWhenValid,
} from '../src/lib/auth-presentation';

describe('email magic-link presentation', () => {
  it.each([
    [' Person+jobs@Example.COM ', 'person+jobs@example.com'],
    ['first.last@sub.example.co.uk', 'first.last@sub.example.co.uk'],
    ['name_123@example.io', 'name_123@example.io'],
  ])('normalizes and accepts common addresses', (input, normalizedEmail) => {
    expect(getEmailSubmissionState(input, false)).toEqual({
      normalizedEmail,
      isValid: true,
      canSubmit: true,
    });
  });

  it.each([
    '',
    '   ',
    'name',
    '@example.com',
    'name@example',
    'name @example.com',
    'name..two@example.com',
    '.name@example.com',
    'name@example..com',
    'name@-example.com',
    'name@example-.com',
  ])('rejects invalid address %j', (input) => {
    expect(getEmailSubmissionState(input, false).canSubmit).toBe(false);
  });

  it('disables submission while another method is loading', () => {
    expect(getEmailSubmissionState('name@example.com', true).canSubmit).toBe(false);
  });

  it('never invokes the service for blank or invalid input', async () => {
    const service = vi.fn(async () => ({ error: null }));

    await expect(submitEmailWhenValid('not-an-email', service)).resolves.toEqual({
      attempted: false,
      normalizedEmail: 'not-an-email',
      result: null,
    });
    expect(service).not.toHaveBeenCalled();
  });

  it('invokes the service once with the normalized address', async () => {
    const result = { error: null };
    const service = vi.fn(async () => result);

    await expect(submitEmailWhenValid(' User@Example.com ', service)).resolves.toEqual({
      attempted: true,
      normalizedEmail: 'user@example.com',
      result,
    });
    expect(service).toHaveBeenCalledOnce();
    expect(service).toHaveBeenCalledWith('user@example.com');
  });
});
