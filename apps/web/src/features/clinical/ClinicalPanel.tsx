import { SuggestionsPanel } from './SuggestionsPanel.js';
import { PrescriptionsPanel } from './PrescriptionsPanel.js';
import { TreatmentPanel } from '../treatment/TreatmentPanel.js';
import type { Identity } from '@clinic/contracts';
import { HttpError } from '../identity/identity.api.js';
import { clinicalMessages as t } from './clinical.messages.js';
import { HistoryForm } from './HistoryForm.js';
import { ChartForm } from './ChartForm.js';
import { ClinicalVersionView } from './ClinicalVersionView.js';
import { useClinicalPatients } from './useClinicalPatients.js';
import { useClinicalRecord } from './useClinicalRecord.js';
export function ClinicalPanel({ identity }: { identity: Identity }) {
  const {
    locks,
    onLock,
    selected,
    setSelected,
    search,
    setSearch,
    key,
    allowed,
    patients,
    visiblePatients,
  } = useClinicalPatients(identity);
  if (!allowed) return null;
  return (
    <section aria-label={t.title} className="clinical">
      <h3>{t.title}</h3>
      <label>
        {t.search}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {patients.isPending && <p role="status">{t.loading}</p>}
      {patients.error && <p role="alert">{patients.error.message}</p>}
      {patients.data?.length === 0 && <p>{t.empty}</p>}
      <ul>
        {visiblePatients?.map((p) => (
          <li key={p.id}>
            <button
              disabled={Object.values(locks).some(Boolean)}
              onClick={() => {
                if (!selected || confirm(t.switchPatient)) setSelected(p.id);
              }}
            >
              {t.openPatient(p.patientNumber, p.name)}
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <ClinicalRecord
          key={selected}
          id={selected}
          identity={identity}
          accountKey={key}
          onLock={onLock}
          patientLabel={patients.data?.find((p) => p.id === selected)}
        />
      )}
    </section>
  );
}
function ClinicalRecord({
  id,
  identity,
  accountKey,
  patientLabel,
  onLock,
}: {
  id: string;
  identity: Identity;
  accountKey: string;
  patientLabel?: { patientNumber: number; name: string };
  onLock: (kind: string, locked: boolean) => void;
}) {
  const { key, connected, query } = useClinicalRecord(id, accountKey);
  if (
    query.error instanceof HttpError &&
    [401, 403, 404].includes(query.error.status)
  )
    return <p role="alert">{query.error.message}</p>;
  if (!query.data)
    return (
      <p role={query.error ? 'alert' : 'status'}>
        {query.error?.message ?? t.loading}
      </p>
    );
  return (
    <div className="clinical-record">
      <h4>{t.dossier(patientLabel?.patientNumber, patientLabel?.name)}</h4>
      {!connected && <p role="alert">{t.disconnected}</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {(['history', 'chart'] as const).map((kind) => {
        const record = query.data[kind];
        return (
          <section key={kind} aria-label={t[kind]}>
            <h4>{t[kind]}</h4>
            {record.current ? (
              <ClinicalVersionView version={record.current} />
            ) : (
              <p>{t.noConfirmed}</p>
            )}
            {record.draft && <ClinicalVersionView version={record.draft} />}
            {kind === 'history' ? (
              <HistoryForm
                id={id}
                record={record}
                identity={identity}
                cacheKey={key}
                onLock={onLock}
              />
            ) : (
              <ChartForm
                id={id}
                record={record}
                identity={identity}
                cacheKey={key}
                onLock={onLock}
              />
            )}
            {identity.permissions.includes('clinical.history') && (
              <details>
                <summary>
                  {t.essentialHistory} — {t[kind]}
                </summary>
                {record.events.length === 0 ? (
                  <p>{t.noVersion}</p>
                ) : (
                  record.events.map((v) => (
                    <ClinicalVersionView key={v.revision} version={v} />
                  ))
                )}
              </details>
            )}
          </section>
        );
      })}
      <SuggestionsPanel
        patientId={id}
        identity={identity}
        chartRevision={query.data.chart.revision}
      />
      <PrescriptionsPanel patientId={id} identity={identity} onLock={onLock} />
      <TreatmentPanel id={id} identity={identity} onLock={onLock} />
      <p>{t.noBilling}</p>
    </div>
  );
}
