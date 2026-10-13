import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Identity, Patient } from '@clinic/contracts';
import { patientApi } from './patient.api.js';
import { PatientForm } from './PatientForm.js';
import { patientText as t } from './patient.messages.js';
import { HttpError } from '../identity/identity.api.js';
export function PatientsPanel({ identity }: { identity: Identity }) {
  const cache = useQueryClient();
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [duplicates, setDuplicates] = useState<Patient[]>([]);
  const read = identity.permissions.includes('patients.read');
  const accountKey = `${identity.clinicId}:${identity.accountId}`;
  const prefix = ['patients', accountKey];
  const list = useQuery({
    queryKey: [...prefix, 'list', q, archived, offset],
    queryFn: ({ signal }) => patientApi.search(q, archived, offset, signal),
    enabled: read,
    gcTime: 0,
  });
  useEffect(() => {
    if (!read) return;
    const stream = new EventSource('/api/patients/events');
    const refresh = () => {
      void cache.invalidateQueries({ queryKey: ['patients', accountKey] });
    };
    stream.addEventListener('invalidate', refresh);
    stream.onopen = refresh;
    stream.onerror = () => {
      refresh();
      void cache.invalidateQueries({ queryKey: ['identity'] });
    };
    return () => {
      stream.close();
      void cache.cancelQueries({ queryKey: ['patients', accountKey] });
      cache.removeQueries({ queryKey: ['patients', accountKey] });
    };
  }, [read, accountKey, cache]);
  const refresh = () => cache.invalidateQueries({ queryKey: prefix });
  return (
    <section aria-label={t.title} className="patients">
      <h3>{t.title}</h3>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {read && !!duplicates.length && (
        <ul aria-label="Doublons possibles">
          {duplicates.map((p) => (
            <li key={p.id}>
              n°{p.patientNumber} — {p.name}
            </li>
          ))}
        </ul>
      )}
      {identity.permissions.includes('patients.create') && (
        <PatientForm
          onError={setError}
          onSave={async (details, commandId) => {
            setError('');
            setNotice('');
            const result = await patientApi.register(details, commandId);
            setNotice(
              result.duplicateWarning ? t.duplicate : t.registered(result.patient.patientNumber),
            );
            setDuplicates(result.duplicates);
            await refresh();
          }}
        />
      )}
      {read && (
        <>
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
                setSelected(null);
                setOffset(0);
              }}
            />
            {t.archived}
          </label>
          {list.isPending && <p role="status">{t.loading}</p>}
          {list.error ? (
            <p role="alert">{list.error.message}</p>
          ) : (
            <ul>
              {list.data?.patients.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      setSelected(p.id);
                      setError('');
                    }}
                  >
                    {t.open(p.patientNumber, p.name)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!list.error && list.data?.patients.length === 0 && <p>{t.empty}</p>}
          <div className="patient-pagination">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>
              Précédents
            </button>
            <button
              disabled={list.data?.patients.length !== 50}
              onClick={() => setOffset(offset + 50)}
            >
              Suivants
            </button>
          </div>
          {selected && (
            <PatientRecord
              key={selected}
              id={selected}
              identity={identity}
              accountKey={accountKey}
              onError={setError}
              onNotice={setNotice}
              onClose={() => setSelected(null)}
            />
          )}
        </>
      )}
    </section>
  );
}
function PatientRecord({
  id,
  identity,
  accountKey,
  onError,
  onNotice,
  onClose,
}: {
  id: string;
  identity: Identity;
  accountKey: string;
  onError: (value: string) => void;
  onNotice: (value: string) => void;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const current = useQuery({
    queryKey: ['patients', accountKey, 'record', id],
    queryFn: ({ signal }) => patientApi.get(id, signal),
    gcTime: 0,
  });
  const history = useQuery({
    queryKey: ['patients', accountKey, 'history', id],
    queryFn: ({ signal }) => patientApi.history(id, signal),
    gcTime: 0,
  });
  const [busy, setBusy] = useState(false);
  const statusRequest = useRef<{
    patient: Patient;
    action: 'archive' | 'reactivate';
    commandId: string;
  } | null>(null);
  if (current.error) return <p role="alert">{current.error.message}</p>;
  if (!current.data) return <p role="status">{t.loading}</p>;
  const patient = current.data;
  async function status() {
    if (!statusRequest.current) {
      if (!confirm(patient.archived ? t.reactivateConfirm : t.archiveConfirm)) return;
      statusRequest.current = {
        patient,
        action: patient.archived ? 'reactivate' : 'archive',
        commandId: crypto.randomUUID(),
      };
    }
    setBusy(true);
    onError('');
    onNotice('');
    try {
      const request = statusRequest.current;
      await patientApi.status(request.patient, request.action, request.commandId);
      onNotice(request.action === 'archive' ? 'Patient archivé.' : 'Patient réactivé.');
      statusRequest.current = null;
      await cache.invalidateQueries({ queryKey: ['patients', accountKey] });
      onClose();
    } catch (error) {
      if (error instanceof HttpError && error.status < 500) statusRequest.current = null;
      onError(error instanceof Error ? error.message : t.unavailable);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="patient-record">
      <h4>
        n°{patient.patientNumber} — {patient.name}
      </h4>
      <p>
        {patient.phone} ·{' '}
        {patient.contactKind === 'guardian' ? `${t.guardian} : ${patient.contactName}` : t.patient}
      </p>
      {identity.permissions.includes('patients.edit') && (
        <PatientEditor
          patient={patient}
          accountKey={accountKey}
          onError={onError}
          onNotice={onNotice}
        />
      )}
      {identity.permissions.includes('patients.archive') && (
        <button
          disabled={busy}
          onClick={() => {
            void status();
          }}
        >
          {busy
            ? t.saving
            : statusRequest.current
              ? t.retry
              : patient.archived
                ? t.reactivate
                : t.archive}
        </button>
      )}
      <h4>{t.history}</h4>
      {history.error ? (
        <p role="alert">{history.error.message}</p>
      ) : (
        <ol>
          {history.data?.map((e) => (
            <li key={e.patient.revision}>
              {t.actions[e.action] ?? e.action} · {new Date(e.at).toLocaleString('fr-FR')} ·{' '}
              {e.actorId}
              <p>
                {e.patient.name} · {e.patient.phone} · {e.patient.contactName}
              </p>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
function PatientEditor({
  patient,
  accountKey,
  onError,
  onNotice,
}: {
  patient: Patient;
  accountKey: string;
  onError: (value: string) => void;
  onNotice: (value: string) => void;
}) {
  const cache = useQueryClient();
  const [revision, setRevision] = useState(patient.revision);
  const submitted = useRef<{ commandId: string; revision: number } | null>(null);
  const [reconciled, setReconciled] = useState(false);
  return (
    <>
      {reconciled && <p>{t.current(patient.name)}</p>}
      <PatientForm
        initial={patient}
        blocked={patient.archived}
        onError={onError}
        onSave={async (details, commandId) => {
          onError('');
          onNotice('');
          if (submitted.current?.commandId !== commandId)
            submitted.current = { commandId, revision };
          const result = await patientApi.edit(
            patient.id,
            details,
            commandId,
            submitted.current.revision,
          );
          setRevision(result.revision);
          onNotice('Coordonnées enregistrées.');
          await cache.invalidateQueries({ queryKey: ['patients', accountKey] });
        }}
      />
      <button
        onClick={async () => {
          try {
            const latest = await patientApi.get(patient.id);
            cache.setQueryData(['patients', accountKey, 'record', patient.id], latest);
            setRevision(latest.revision);
            setReconciled(true);
          } catch (error) {
            onError(error instanceof Error ? error.message : t.unavailable);
          }
        }}
      >
        {t.reload}
      </button>
    </>
  );
}
