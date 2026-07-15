export type EmailSubmissionState = {
  normalizedEmail: string;
  isValid: boolean;
  canSubmit: boolean;
};

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmailAddress(value: string): boolean {
  const email = normalizeEmailAddress(value);
  if (!email || email.length > 254) return false;

  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  if (!domain || domain.length > 253 || domain.includes('..')) return false;

  const labels = domain.split('.');
  if (labels.length < 2 || labels.at(-1)!.length < 2) return false;
  return labels.every((label) => (
    label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  ));
}

export function getEmailSubmissionState(value: string, busy: boolean): EmailSubmissionState {
  const normalizedEmail = normalizeEmailAddress(value);
  const isValid = isValidEmailAddress(normalizedEmail);
  return { normalizedEmail, isValid, canSubmit: isValid && !busy };
}

export async function submitEmailWhenValid<T>(
  value: string,
  submit: (normalizedEmail: string) => Promise<T>,
): Promise<{ attempted: boolean; normalizedEmail: string; result: T | null }> {
  const { normalizedEmail, isValid } = getEmailSubmissionState(value, false);
  if (!isValid) return { attempted: false, normalizedEmail, result: null };
  return { attempted: true, normalizedEmail, result: await submit(normalizedEmail) };
}
