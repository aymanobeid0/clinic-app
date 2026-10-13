import { identitySchema, type Identity, type RecoveryCodes, type SignIn } from '@clinic/contracts';

let csrfToken = '';
export async function refreshSession() {
  const response = await fetch('/api/session', { cache: 'no-store' });
  if (!response.ok) throw new Error('Service indisponible. Réessayez.');
  csrfToken = (await response.json()).csrfToken;
}

export async function post<T = undefined>(path: string, body: object): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data =
    response.status === 204 || response.status === 202 ? undefined : await response.json();
  if (!response.ok) throw new Error(data?.error ?? 'Service indisponible. Réessayez.');
  if (data?.csrfToken) csrfToken = data.csrfToken;
  return data as T;
}

export const identityApi = {
  async getIdentity(): Promise<Identity | null> {
    await refreshSession();
    const response = await fetch('/api/identity', { cache: 'no-store' });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('Service indisponible. Réessayez.');
    return identitySchema.parse(await response.json());
  },
  async getClinic(): Promise<{ code: string; name: string }> {
    const response = await fetch('/api/clinic', { cache: 'no-store' });
    if (!response.ok) throw new Error('Accès indisponible. Reconnectez-vous.');
    return response.json();
  },
  signIn(input: SignIn) {
    return post('sign-in', input);
  },
  signOut() {
    return post('sign-out', {});
  },
  replacePassword(password: string) {
    return post('onboarding/password', { password });
  },
  sendVerification(email: string) {
    return post('onboarding/email', { email });
  },
  verifyEmail(token: string) {
    return post<RecoveryCodes | null>('onboarding/verify-email', { token });
  },
  regenerateCodes(password: string) {
    return post<RecoveryCodes>('onboarding/codes', { password });
  },
  confirmSavedCodes(batchId: string) {
    return post('onboarding/codes-saved', { batchId, saved: true });
  },
};
