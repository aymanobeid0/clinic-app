import { useState } from "react";
import { Link, useParams } from "react-router";
import type { Identity, Patient } from "@clinic/contracts";
import { usePatients } from "../features/patients/usePatients.js";
import { usePatientEvents } from "../features/patients/usePatientEvents.js";
import { usePatientRecord } from "../features/patients/usePatientRecord.js";
import { usePatientEditor } from "../features/patients/usePatientEditor.js";
import { HttpError } from "../features/identity/identity.api.js";
import { PatientForm } from "../features/patients/PatientForm.js";
import { patientText as t } from "../features/patients/patient.messages.js";

const can = (identity: Identity, permission: string) =>
  identity.permissions.includes(permission);
const accountKeyOf = (identity: Identity) =>
  `${identity.clinicId}:${identity.accountId}`;

export function PatientsDenied() {
  return (
    <>
      <h1>{t.denied}</h1>
      <p>{t.deniedText}</p>
      <Link to="/">{t.home}</Link>
    </>
  );
}

function Contact({ patient }: { patient: Patient }) {
  return (
    <>
      {patient.phone} ·{" "}
      {patient.contactKind === "guardian"
        ? `${t.guardian} : ${patient.contactName}`
        : t.patient}
    </>
  );
}

function PatientRow({ patient }: { patient: Patient }) {
  return (
    <li>
      <Link to={`/patients/${patient.id}`}>
        <span className="patient-number">n°{patient.patientNumber}</span>
        <span className="patient-name">{patient.name}</span>
        <span className="patient-contact">
          <Contact patient={patient} />
        </span>
        {patient.archived && <span className="badge">{t.archivedBadge}</span>}
      </Link>
    </li>
  );
}

export function PatientList({ identity }: { identity: Identity }) {
  const { q, setQ, archived, setArchived, offset, setOffset, list } =
    usePatients({ identity });
  const patients = list.data?.patients;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t.title}</h1>
          <p className="description">{t.listIntro}</p>
        </div>
        {can(identity, "patients.create") && (
          <Link className="button" to="/patients/nouveau">
            {t.register}
          </Link>
        )}
      </div>
      <section className="surface" aria-label="Liste des patients">
        <div className="patient-toolbar">
          <label>
            {t.search}
            <input
              type="search"
              value={q}
              maxLength={120}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label className="checkbox">
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
        </div>
        {list.error ? (
          <p role="alert">{list.error.message}</p>
        ) : list.isPending ? (
          <p role="status">{t.loading}</p>
        ) : patients?.length ? (
          <ul className="patient-list">
            {patients.map((p) => (
              <PatientRow key={p.id} patient={p} />
            ))}
          </ul>
        ) : (
          <p className="empty">{t.empty}</p>
        )}
        {(offset > 0 || patients?.length === 50) && (
          <div className="patient-pagination">
            <button
              className="secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              {t.previous}
            </button>
            <button
              className="secondary"
              disabled={patients?.length !== 50}
              onClick={() => setOffset(offset + 50)}
            >
              {t.next}
            </button>
          </div>
        )}
      </section>
    </>
  );
}

export function PatientRegistration({ identity }: { identity: Identity }) {
  const { register, notice, error, setError, duplicates } = usePatients({
    identity,
    browse: false,
  });
  const [created, setCreated] = useState<Patient | null>(null);
  return (
    <div className="patient-narrow">
      <Link to="/patients">← {t.back}</Link>
      <h1>{t.register}</h1>
      <p className="description">{t.registerIntro}</p>
      {error && <p role="alert">{error}</p>}
      {notice && (
        <div className="notice" role="status">
          <p>{notice}</p>
          {created && (
            <Link to={`/patients/${created.id}`}>
              {t.openRecord(created.patientNumber)}
            </Link>
          )}
        </div>
      )}
      {!!duplicates.length && (
        <section className="surface">
          <h2>{t.duplicates}</h2>
          <ul className="patient-list" aria-label={t.duplicates}>
            {duplicates.map((p) => (
              <PatientRow key={p.id} patient={p} />
            ))}
          </ul>
        </section>
      )}
      <section className="surface">
        <PatientForm
          onError={setError}
          onSave={async (details, commandId) => {
            setCreated(null);
            setCreated((await register(details, commandId)).patient);
          }}
        />
      </section>
    </div>
  );
}

export function PatientProfile({ identity }: { identity: Identity }) {
  const { id = "" } = useParams();
  const accountKey = accountKeyOf(identity);
  usePatientEvents(true, accountKey);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { current, history, busy, statusRequest, patient, status } =
    usePatientRecord({
      id,
      accountKey,
      onError: setError,
      onNotice: setNotice,
      onClose: () => {},
    });
  // Keep the profile (and any unsaved draft) mounted when a refresh fails.
  const refreshFailed = current.error && (
    <div role="alert">
      <p>{current.error.message}</p>
      <button className="quiet" onClick={() => void current.refetch()}>
        {t.retryLoad}
      </button>
    </div>
  );
  if (!patient)
    return current.error ? (
      <>
        <Link to="/patients">← {t.back}</Link>
        <h1>{t.title}</h1>
        {current.error instanceof HttpError &&
        [403, 404].includes(current.error.status) ? (
          <p role="alert">{t.notFound}</p>
        ) : (
          refreshFailed
        )}
      </>
    ) : (
      <p role="status">{t.loading}</p>
    );
  return (
    <>
      <Link to="/patients">← {t.back}</Link>
      <div className="page-heading">
        <div>
          <p className="description">{t.record(patient.patientNumber)}</p>
          <h1>{patient.name}</h1>
          <p className="description">
            <Contact patient={patient} />
          </p>
        </div>
        <span className="badge">
          {patient.archived ? t.archivedBadge : t.activeBadge}
        </span>
      </div>
      {refreshFailed}
      {error && <p role="alert">{error}</p>}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="patient-profile">
        {can(identity, "patients.edit") && (
          <section className="surface">
            <PatientEditor
              patient={patient}
              accountKey={accountKey}
              onError={setError}
              onNotice={setNotice}
            />
          </section>
        )}
        <div>
          {can(identity, "patients.archive") && (
            <section className="surface">
              <h2>{t.status}</h2>
              <p className="description">
                {patient.archived ? t.reactivateConfirm : t.archiveConfirm}
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  void status(
                    !!statusRequest.current ||
                      confirm(
                        patient.archived
                          ? t.reactivateConfirm
                          : t.archiveConfirm,
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
            </section>
          )}
          <section className="surface">
            <h2>{t.history}</h2>
            {history.error ? (
              <p role="alert">{history.error.message}</p>
            ) : history.isPending ? (
              <p role="status">{t.loading}</p>
            ) : (
              <ol className="task-list">
                {history.data?.map((e) => (
                  <li key={e.patient.revision}>
                    <strong>{t.actions[e.action] ?? e.action}</strong>
                    <span>
                      {new Date(e.at).toLocaleString("fr-FR")} · {e.actorId}
                    </span>
                    <span>
                      {e.patient.name} · {e.patient.phone}
                      {e.patient.contactName && ` · ${e.patient.contactName}`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
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
      {reconciled && <p className="hint">{t.current(patient.name)}</p>}
      <PatientForm
        initial={patient}
        blocked={patient.archived}
        onError={onError}
        onSave={save}
      />
      <button className="quiet" onClick={reload}>
        {t.reload}
      </button>
    </>
  );
}
