import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HttpError } from '../identity/identity.api.js';
import { clinicalMessages as t } from './clinical.messages.js';
import { clinicalApi } from './clinical.api.js';
export function useClinicalSave(
  id: string,
  kind: string,
  initialRevision: number,
  cacheKey: readonly string[],
  onLock: (kind: string, locked: boolean) => void,
  onDraftSaved?: () => void,
) {
  const cache = useQueryClient();
  const [revision, setRevision] = useState(initialRevision);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    onLock(kind, busy || uncertain);
    return () => onLock(kind, false);
  }, [busy, uncertain, kind, onLock]);
  const pending = useRef<{ action: string; data: object } | null>(null);
  async function save(
    action: 'draft' | 'confirm',
    content?: object,
    observedAt?: string,
  ) {
    pending.current ??= {
      action,
      data: {
        commandId: crypto.randomUUID(),
        revision,
        ...(action === 'draft' ? { content, observedAt } : {}),
      },
    };
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const request = pending.current;
      const result = await clinicalApi.save(
        id,
        kind,
        request.action,
        request.data,
      );
      pending.current = null;
      if (request.action === 'draft') onDraftSaved?.();
      setUncertain(false);
      setRevision(result.revision);
      setNotice(t.saved);
      await cache.invalidateQueries({ queryKey: cacheKey });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t.unavailable);
      if (e instanceof HttpError && e.status < 500) {
        pending.current = null;
        setUncertain(false);
      } else setUncertain(true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function reconcile() {
    setBusy(true);
    setError('');
    try {
      const latest = await clinicalApi.get(id);
      cache.setQueryData(cacheKey, latest);
      setRevision(latest[kind as 'history' | 'chart'].revision);
      setNotice(t.reconciled);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.reloadUnavailable);
    } finally {
      setBusy(false);
    }
  }
  const retry = () =>
    save(pending.current?.action === 'draft' ? 'draft' : 'confirm');
  return { retry, save, reconcile, busy, error, notice, uncertain, revision };
}
export type ClinicalSave = ReturnType<typeof useClinicalSave>;
