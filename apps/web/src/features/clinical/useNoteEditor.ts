import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import type { VisitNote } from '@clinic/contracts';
import { post, HttpError } from '../identity/identity.api.js';
import { treatmentGet } from '../treatment/treatment.api.js';
import { noteMessages as t } from './note.messages.js';
export function useNoteEditor(
  patientId: string,
  record: VisitNote,
  cacheKey: string[],
  onLock: (kind: string, value: boolean) => void,
) {
  const cache = useQueryClient(),
    path = `clinical/${patientId}/notes/${record.visitId}`;
  const initial =
    record.draft?.content.text ?? record.current?.content.text ?? '';
  const form = useForm({ defaultValues: { text: initial } });
  const text = form.watch('text'),
    textRef = useRef(text);
  textRef.current = text;
  const [savedText, setSavedText] = useState(initial),
    [revision, setRevision] = useState(record.revision);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [uncertain, setUncertain] = useState(false),
    [conflict, setConflict] = useState(false);
  const [compared, setCompared] = useState<VisitNote | null>(null);
  const inFlight = useRef(false),
    pending = useRef<{
      action: 'draft' | 'finalize';
      data: { commandId: string; revision: number; text?: string };
    } | null>(null);
  const dirty = text !== savedText,
    locked = dirty || busy || uncertain || conflict;
  useEffect(() => {
    const kind = `notes:${record.visitId}`;
    onLock(kind, locked);
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    if (locked) window.addEventListener('beforeunload', warn);
    return () => {
      onLock(kind, false);
      window.removeEventListener('beforeunload', warn);
    };
  }, [record.visitId, onLock, locked]);
  useEffect(() => {
    if (
      !dirty &&
      !busy &&
      !uncertain &&
      !conflict &&
      record.revision > revision
    ) {
      const value =
        record.draft?.content.text ?? record.current?.content.text ?? '';
      form.reset({ text: value });
      setSavedText(value);
      setRevision(record.revision);
    }
  }, [record, dirty, busy, uncertain, conflict, revision, form]);
  async function save(action: 'draft' | 'finalize' = 'draft') {
    if (inFlight.current || conflict) return;
    pending.current ??= {
      action,
      data: {
        commandId: crypto.randomUUID(),
        revision,
        ...(action === 'draft' ? { text: textRef.current } : {}),
      },
    };
    const request = pending.current;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await post<VisitNote>(
        `${path}/${request.action}`,
        request.data,
      );
      pending.current = null;
      setUncertain(false);
      setRevision(result.revision);
      if (request.action === 'draft') setSavedText(request.data.text!);
      cache.setQueryData<VisitNote[]>(cacheKey, (rows) =>
        rows?.map((r) =>
          r.visitId === result.visitId && r.revision <= result.revision
            ? result
            : r,
        ),
      );
      void cache.invalidateQueries({ queryKey: cacheKey });
    } catch (e) {
      setError(e instanceof HttpError ? e.message : t.unavailable);
      if (e instanceof HttpError && e.status < 500) {
        pending.current = null;
        setUncertain(false);
        setConflict(e.status === 409);
      } else setUncertain(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!dirty || busy || uncertain || conflict || error) return;
    const timer = setTimeout(() => {
      void save();
    }, 800);
    return () => clearTimeout(timer);
  });
  async function compare() {
    if (inFlight.current || uncertain) return;
    setBusy(true);
    try {
      setCompared(await treatmentGet<VisitNote>(path));
      setConflict(true);
    } catch (e) {
      setError(e instanceof HttpError ? e.message : t.compareUnavailable);
    } finally {
      setBusy(false);
    }
  }
  function resolve(keepMine: boolean) {
    if (!compared) return;
    const serverText =
      compared.draft?.content.text ?? compared.current?.content.text ?? '';
    setRevision(compared.revision);
    setSavedText(serverText);
    if (!keepMine) form.reset({ text: serverText });
    cache.setQueryData<VisitNote[]>(cacheKey, (rows) =>
      rows?.map((r) => (r.visitId === compared.visitId ? compared : r)),
    );
    setCompared(null);
    setConflict(false);
    setError('');
  }
  return {
    form,
    text,
    dirty,
    revision,
    busy,
    saving: busy && !!pending.current,
    error,
    uncertain,
    conflict,
    compared,
    save,
    compare,
    resolve,
  };
}
