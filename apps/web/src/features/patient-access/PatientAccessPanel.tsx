import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { Identity, PatientAccess, AssignmentCandidate, Patient } from '@clinic/contracts';
import { HttpError } from '../identity/identity.api.js';
import { accessApi } from './access.api.js';
import { accessText as t } from './access.messages.js';
export function PatientAccessPanel({ identity }: { identity: Identity }) {
  const allowed = identity.isManager || identity.permissions.includes('patients.assign');
  const key = `${identity.clinicId}:${identity.accountId}`;
  const cache = useQueryClient();
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState(false);
  const [offset, setOffset] = useState(0);
  const [locked, setLocked] = useState(false);
  const [selected, setSelected] = useState<Pick<Patient, 'id' | 'name' | 'patientNumber'> | null>(
    null,
  );
  const patients = useQuery({
    queryKey: ['patient-access', key, 'patients', q, archived, offset],
    queryFn: ({ signal }) => accessApi.patients(q, archived, offset, signal),
    enabled: allowed,
    gcTime: 0,
  });
  const candidates = useQuery({
    queryKey: ['patient-access', key, 'candidates'],
    queryFn: ({ signal }) => accessApi.candidates(signal),
    enabled: allowed,
    gcTime: 0,
  });
  useEffect(() => {
    if (!allowed) return;
    const stream = new EventSource('/api/assignment-events');
    const refresh = () => {
      void cache.invalidateQueries({ queryKey: ['patient-access', key] });
    };
    stream.addEventListener('invalidate', refresh);
    stream.onopen = refresh;
    stream.onerror = () => {
      refresh();
      void cache.invalidateQueries({ queryKey: ['identity'] });
    };
    return () => {
      stream.close();
      void cache.cancelQueries({ queryKey: ['patient-access', key] });
      cache.removeQueries({ queryKey: ['patient-access', key] });
    };
  }, [allowed, key, cache]);
  if (!allowed) return null;
  return (
    <section aria-label={t.title} className="patients">
      <h3>{t.title}</h3>
      <label>
        {t.search}
        <input
          value={q}
          maxLength={120}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => {
            setArchived(e.target.checked);
            setOffset(0);
          }}
        />
        {t.archived}
      </label>
      {patients.isPending && <p role="status">{t.loading}</p>}
      {patients.error ? (
        <p role="alert">{patients.error.message}</p>
      ) : (
        <ul>
          {patients.data?.patients.map((p) => (
            <li key={p.id}>
              n°{p.patientNumber} — {p.name} — {p.phone}
              <button disabled={locked} onClick={() => setSelected(p)}>
                {t.select} n°{p.patientNumber}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>
        {t.previous}
      </button>
      <button
        disabled={(patients.data?.patients.length ?? 0) < 50}
        onClick={() => setOffset(offset + 50)}
      >
        {t.next}
      </button>
      {candidates.error && <p role="alert">{candidates.error.message}</p>}
      {selected && candidates.data && (
        <AccessEditor
          key={selected.id}
          id={selected.id}
          patientLabel={`n°${selected.patientNumber} — ${selected.name}`}
          accountKey={key}
          candidates={candidates.data}
          onLock={setLocked}
        />
      )}
    </section>
  );
}
function AccessEditor({
  id,
  accountKey,
  candidates,
  onLock,
  patientLabel,
}: {
  id: string;
  accountKey: string;
  candidates: AssignmentCandidate[];
  onLock: (locked: boolean) => void;
  patientLabel: string;
}) {
  const cache = useQueryClient();
  const prefix = ['patient-access', accountKey];
  const record = useQuery({
    queryKey: [...prefix, id],
    queryFn: ({ signal }) => accessApi.get(id, signal),
    gcTime: 0,
  });
  const history = useQuery({
    queryKey: [...prefix, id, 'history'],
    queryFn: ({ signal }) => accessApi.history(id, signal),
    gcTime: 0,
  });
  const form = useForm<{ accountId: string; kind: 'assigned' | 'shared' }>({
    defaultValues: { accountId: '', kind: 'shared' },
  });
  const pending = useRef<{
    action: 'share' | 'remove';
    data: {
      accountId: string;
      kind?: 'assigned' | 'shared';
      revision: number;
      commandId: string;
    };
  } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const change = async (
    action: 'share' | 'remove',
    accountId: string,
    kind?: 'assigned' | 'shared',
  ) => {
    if ((!record.data || record.error) && !pending.current) return;
    pending.current ??= {
      action,
      data: {
        accountId,
        kind,
        revision: record.data!.revision,
        commandId: crypto.randomUUID(),
      },
    };
    setBusy(true);
    onLock(true);
    setMessage('');
    try {
      const cmd = pending.current;
      if (cmd.action === 'share') await accessApi.share(id, { ...cmd.data, kind: cmd.data.kind! });
      else
        await accessApi.remove(id, {
          accountId: cmd.data.accountId,
          revision: cmd.data.revision,
          commandId: cmd.data.commandId,
        });
      pending.current = null;
      setUncertain(false);
      onLock(false);
      setMessage(action === 'share' ? t.saved : t.removed);
      await cache.invalidateQueries({ queryKey: prefix });
    } catch (e) {
      if (e instanceof HttpError && e.status < 500) {
        pending.current = null;
        setUncertain(false);
        onLock(false);
      } else {
        setUncertain(true);
        onLock(true);
      }
      setMessage(e instanceof Error ? e.message : t.unavailable);
    } finally {
      setBusy(false);
    }
  };
  if (
    record.error instanceof HttpError &&
    (record.error.status === 401 || record.error.status === 403)
  )
    return <p role="alert">{record.error.message}</p>;
  if (!record.data) return <p role="status">{t.loading}</p>;
  const current: PatientAccess = record.data;
  return (
    <div>
      <h4>{t.editor}</h4>
      <p>{patientLabel}</p>
      {record.error && <p role="alert">{record.error.message}</p>}
      {message && <p role="status">{message}</p>}
      {uncertain && <p role="alert">{t.pending}</p>}
      <form onSubmit={form.handleSubmit((v) => change('share', v.accountId, v.kind))}>
        <fieldset disabled={busy || uncertain}>
          <label>
            {t.account}
            <select required {...form.register('accountId', { required: true })}>
              <option value="">{t.placeholder}</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName} ({c.kind === 'doctor' ? t.doctor : t.staff})
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.kind}
            <select {...form.register('kind')}>
              <option value="shared">{t.shared}</option>
              <option value="assigned">{t.assigned}</option>
            </select>
          </label>
        </fieldset>
        <button disabled={busy || uncertain} type="submit">
          {t.share}
        </button>
      </form>
      {uncertain && (
        <button
          disabled={busy}
          onClick={() => {
            const cmd = pending.current;
            if (cmd) void change(cmd.action, cmd.data.accountId, cmd.data.kind);
          }}
        >
          {t.retry}
        </button>
      )}
      <button
        disabled={busy || uncertain}
        onClick={() => {
          void cache.invalidateQueries({ queryKey: prefix });
        }}
      >
        {t.reload}
      </button>
      {current.grants.length === 0 ? (
        <p>{t.none}</p>
      ) : (
        <ul aria-label={t.active}>
          {current.grants.map((g) => (
            <li key={g.accountId}>
              {g.displayName} — {g.kind === 'assigned' ? t.assigned : t.shared}
              <button
                disabled={busy || uncertain}
                onClick={() => {
                  if (window.confirm(`${patientLabel} — ${g.displayName}\n${t.confirm}`))
                    void change('remove', g.accountId);
                }}
              >
                {t.remove} {g.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
      <h4>{t.history}</h4>
      {history.error ? (
        <p role="alert">{history.error.message}</p>
      ) : (
        <ol>
          {history.data?.map((h) => (
            <li key={h.snapshot.revision}>
              {new Date(h.at).toLocaleString('fr-FR')} —{' '}
              {h.action === 'share' ? t.shareAction : t.removeAction} — {h.accountDisplayName} —{' '}
              {t.by} {h.actorDisplayName}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
