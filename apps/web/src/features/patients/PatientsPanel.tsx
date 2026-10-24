import { usePatientEditor } from './usePatientEditor.js';
import { usePatientRecord } from './usePatientRecord.js';
import { usePatients } from './usePatients.js';
import type { Identity, Patient } from '@clinic/contracts';
import { PatientForm } from './PatientForm.js';
import { patientText as t } from './patient.messages.js';
export function PatientsPanel({ identity }: { identity: Identity }) {
  const {
    register,
    q,
    setQ,
    archived,
    setArchived,
    offset,
    setOffset,
    selected,
    setSelected,
    notice,
    setNotice,
    error,
    setError,
    duplicates,
    read,
    accountKey,
    list,
  } = usePatients({ identity });
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
        <PatientForm onError={setError} onSave={register} />
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
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
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
  const { current, history, busy, statusRequest, patient, status } =
    usePatientRecord({ id, accountKey, onError, onNotice, onClose });
  if (current.error) return <p role="alert">{current.error.message}</p>;
  if (!current.data) return <p role="status">{t.loading}</p>;
  return (
    <article className="patient-record">
      <h4>
        n°{patient.patientNumber} — {patient.name}
      </h4>
      <p>
        {patient.phone} ·{' '}
        {patient.contactKind === 'guardian'
          ? `${t.guardian} : ${patient.contactName}`
          : t.patient}
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
            void status(
              !!statusRequest.current ||
                confirm(
                  patient.archived ? t.reactivateConfirm : t.archiveConfirm,
                ),
            );
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
              {t.actions[e.action] ?? e.action} ·{' '}
              {new Date(e.at).toLocaleString('fr-FR')} · {e.actorId}
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
  const { reconciled, save, reload } = usePatientEditor({
    patient,
    accountKey,
    onError,
    onNotice,
  });
  return (
    <>
      {reconciled && <p>{t.current(patient.name)}</p>}
      <PatientForm
        initial={patient}
        blocked={patient.archived}
        onError={onError}
        onSave={save}
      />
      <button onClick={reload}>{t.reload}</button>
    </>
  );
}
