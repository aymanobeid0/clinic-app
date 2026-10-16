import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HttpError, post } from '../identity/identity.api.js';
import { treatmentMessages as t } from './treatment.messages.js';
export function useTreatmentCommand<T>(
  cacheKey: readonly string[],
  onSuccess?: (v: T) => void,
  onLock?: (kind: string, locked: boolean) => void,
  successMessage: string = t.saved,
) {
  const cache = useQueryClient();
  const pending = useRef<{ path: string; data: object } | null>(null);
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    onLock?.('treatment', busy || uncertain);
    return () => onLock?.('treatment', false);
  }, [onLock, busy, uncertain]);
  async function save(path: string, data: object) {
    if (busy) return;
    pending.current ??= {
      path,
      data: { ...data, commandId: crypto.randomUUID() },
    };
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const p = pending.current;
      const result = await post<T>(p.path, p.data);
      pending.current = null;
      setUncertain(false);
      setNotice(successMessage);
      onSuccess?.(result);
      await cache.invalidateQueries({ queryKey: cacheKey });
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Service indisponible.');
      if (e instanceof HttpError && e.status < 500) {
        pending.current = null;
        setUncertain(false);
      } else setUncertain(true);
    } finally {
      setBusy(false);
    }
  }
  return {
    save,
    retry: () =>
      pending.current && save(pending.current.path, pending.current.data),
    busy,
    uncertain,
    error,
    notice,
  };
}
export type TreatmentCommandState = {
  busy: boolean;
  uncertain: boolean;
  error: string;
  notice: string;
  retry: () => unknown;
};
export function CommandState({ state }: { state: TreatmentCommandState }) {
  return (
    <>
      {state.error && <p role="alert">{state.error}</p>}
      {state.uncertain && (
        <>
          <p role="alert">{t.uncertain}</p>
          <button
            type="button"
            disabled={state.busy}
            onClick={() => {
              void state.retry();
            }}
          >
            {t.retry}
          </button>
        </>
      )}
      {(state.busy || state.notice) && (
        <p role="status">{state.busy ? t.saving : state.notice}</p>
      )}
    </>
  );
}
