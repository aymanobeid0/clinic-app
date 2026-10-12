import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RecoveryCodes, SignIn } from '@clinic/contracts';
import { identityApi, refreshSession } from './identity.api.js';

// Server records belong to TanStack Query; form values live in each form.
// One-time codes and notices remain only in this mounted page's memory.
export function useIdentitySession() {
  const cache = useQueryClient();
  const identity = useQuery({ queryKey: ['identity'], queryFn: identityApi.getIdentity });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<(RecoveryCodes & { owner: string }) | null>(null);
  const accountKey =
    identity.data && !identity.error
      ? `${identity.data.clinicId}:${identity.data.accountId}`
      : undefined;
  const clinic = useQuery({
    queryKey: ['clinic', accountKey],
    queryFn: identityApi.getClinic,
    enabled: identity.data?.stage === 'ready' && !!accountKey,
    gcTime: 0,
  });
  const visibleCodes = codes && codes.owner === accountKey ? codes : null;
  useEffect(() => {
    setCodes(null);
  }, [accountKey]);
  const [verificationToken, setVerificationToken] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get('verification') ?? '',
  );

  useEffect(() => {
    function captureVerificationLink() {
      const token = new URLSearchParams(location.hash.slice(1)).get('verification');
      if (!token) return;
      setVerificationToken(token);
      history.replaceState(null, '', location.pathname + location.search);
    }
    captureVerificationLink();
    window.addEventListener('hashchange', captureVerificationLink);
    return () => window.removeEventListener('hashchange', captureVerificationLink);
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Service indisponible.');
    } finally {
      setBusy(false);
    }
  }

  const reloadIdentity = () => cache.invalidateQueries({ queryKey: ['identity'] });

  return {
    identity: identity.data,
    clinic: clinic.data,
    loading: identity.isPending,
    unavailable: !!identity.error,
    error: error || identity.error?.message || clinic.error?.message,
    notice,
    busy,
    codes: visibleCodes,
    verificationToken,
    setValidationError: setError,
    signIn(input: SignIn) {
      return run(async () => {
        setCodes(null);
        await identityApi.signIn(input);
        await reloadIdentity();
      });
    },
    replacePassword(password: string) {
      return run(async () => {
        await identityApi.replacePassword(password);
        await refreshSession();
        await reloadIdentity();
        setNotice('Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.');
      });
    },
    sendVerification(email: string) {
      return run(async () => {
        await identityApi.sendVerification(email);
        setNotice('Message envoyé. Ouvrez le lien reçu ou saisissez son code de vérification.');
      });
    },
    verifyEmail(token: string) {
      return run(async () => {
        const result = await identityApi.verifyEmail(token);
        if (accountKey && result) setCodes({ ...result, owner: accountKey });
        setVerificationToken('');
        await reloadIdentity();
      });
    },
    regenerateCodes(password: string) {
      return run(async () => {
        const result = await identityApi.regenerateCodes(password);
        if (accountKey) setCodes({ ...result, owner: accountKey });
      });
    },
    confirmSavedCodes() {
      return run(async () => {
        if (!visibleCodes) return;
        await identityApi.confirmSavedCodes(visibleCodes.batchId);
        setCodes(null);
        await reloadIdentity();
      });
    },
    signOut() {
      return run(async () => {
        await identityApi.signOut();
        setCodes(null);
        setVerificationToken('');
        cache.clear();
        await reloadIdentity();
      });
    },
  };
}
