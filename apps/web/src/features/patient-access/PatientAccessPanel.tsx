import { useAssignmentEditor } from './useAssignmentEditor.js';
import { usePatientAssignments } from './usePatientAssignments.js';
import type {
  Identity,
  PatientAccess,
  AssignmentCandidate,
} from '@clinic/contracts';
import { HttpError } from '../identity/identity.api.js';
import { accessText as t } from './access.messages.js';
export function PatientAccessPanel({ identity }: { identity: Identity }) {
  const {
    allowed,
    key,
    q,
    setQ,
    archived,
    setArchived,
    offset,
    setOffset,
    locked,
    setLocked,
    selected,
    setSelected,
    patients,
    candidates,
  } = usePatientAssignments({ identity });
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
      <button
        disabled={offset === 0}
        onClick={() => setOffset(Math.max(0, offset - 50))}
      >
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
  const {
    submit,
    retry,
    reload,
    record,
    history,
    form,
    uncertain,
    busy,
    message,
    change,
  } = useAssignmentEditor({ id, accountKey, onLock });
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
      <form onSubmit={submit}>
        <fieldset disabled={busy || uncertain}>
          <label>
            {t.account}
            <select
              required
              {...form.register('accountId', { required: true })}
            >
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
        <button disabled={busy} onClick={retry}>
          {t.retry}
        </button>
      )}
      <button disabled={busy || uncertain} onClick={reload}>
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
                  if (
                    window.confirm(
                      `${patientLabel} — ${g.displayName}\n${t.confirm}`,
                    )
                  )
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
              {h.action === 'share' ? t.shareAction : t.removeAction} —{' '}
              {h.accountDisplayName} — {t.by} {h.actorDisplayName}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
