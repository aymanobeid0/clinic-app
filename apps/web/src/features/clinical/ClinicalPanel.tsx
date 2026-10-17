import {SuggestionsPanel} from './SuggestionsPanel.js';
import {PrescriptionsPanel} from './PrescriptionsPanel.js';
import {TreatmentPanel} from '../treatment/TreatmentPanel.js';
import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Identity } from '@clinic/contracts';
import { HttpError } from '../identity/identity.api.js';
import { clinicalApi } from './clinical.api.js';
import { clinicalMessages as t } from './clinical.messages.js';
import { HistoryForm } from './HistoryForm.js';
import { ChartForm } from './ChartForm.js';
import { ClinicalVersionView } from './ClinicalVersionView.js';
export function ClinicalPanel({ identity }: { identity: Identity }) {
  const cache = useQueryClient();
  const [locks, setLocks] = useState<Record<string, boolean>>({});
  const onLock = useCallback(
    (kind: string, locked: boolean) =>
      setLocks((old) =>
        old[kind] === locked ? old : { ...old, [kind]: locked },
      ),
    [],
  );
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const key = `${identity.clinicId}:${identity.accountId}`;
  const allowed =
    (identity.kind === 'doctor' ||
      (identity.kind === 'staff' && !identity.isManager)) &&
    identity.permissions.includes('clinical.read');
  const patients = useQuery({
    queryKey: ['clinical-patients', key],
    queryFn: ({ signal }) => clinicalApi.patients(signal),
    enabled: allowed,
    gcTime: 0,
  });
  useEffect(() => {
    if (!allowed) return;
    const stream = new EventSource('/api/clinical-events');
    const refresh = () => {
      void cache.invalidateQueries({ queryKey: ['clinical-patients', key] });
      void cache.invalidateQueries({ queryKey: ['identity'] });
    };
    stream.addEventListener('invalidate', refresh);
    stream.onopen = refresh;
    stream.onerror = refresh;
    return () => {
      stream.close();
      void cache.cancelQueries({ queryKey: ['clinical-patients', key] });
      cache.removeQueries({ queryKey: ['clinical-patients', key] });
    };
  }, [allowed, key, cache]);
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
        {patients.data
          ?.filter((p) =>
            `${p.patientNumber} ${p.name}`
              .toLocaleLowerCase('fr')
              .includes(search.toLocaleLowerCase('fr')),
          )
          .map((p) => (
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
  const cache = useQueryClient();
  const key = ['clinical', accountKey, id];
  const [connected, setConnected] = useState(true);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => clinicalApi.get(id, signal),
    gcTime: 0,
    retry: false,
  });
  useEffect(() => {
    const stream = new EventSource(`/api/clinical/${id}/events`);
    const refresh = () => {
      setConnected(true);
      void cache.invalidateQueries({ queryKey: ['clinical', accountKey, id] });
      void cache.invalidateQueries({
        queryKey: ['clinical-patients', accountKey],
      });
    };
    stream.addEventListener('invalidate', (event) => {
      const scope=(JSON.parse((event as MessageEvent<string>).data) as {scope?:string}).scope;
      if(scope==='prescriptions')void cache.invalidateQueries({queryKey:['prescriptions']});
      else if(scope==='medications')void cache.invalidateQueries({queryKey:['medications']});
      else if(scope==='suggestions'){void cache.invalidateQueries({queryKey:['chart-suggestions']});void cache.invalidateQueries({queryKey:['clinical',accountKey,id]});}
      else refresh();
    });
    stream.onopen = () => {refresh();void cache.invalidateQueries({queryKey:['prescriptions']});void cache.invalidateQueries({queryKey:['chart-suggestions']});void cache.invalidateQueries({queryKey:['medications']});};
    stream.onerror = () => {
      setConnected(false);
      void cache.invalidateQueries({ queryKey: ['clinical', accountKey, id] });
    };
    return () => {
      stream.close();
      void cache.cancelQueries({ queryKey: ['clinical', accountKey, id] });
      cache.removeQueries({ queryKey: ['clinical', accountKey, id] });
    };
  }, [id, accountKey, cache]);
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
      <SuggestionsPanel patientId={id} identity={identity} chartRevision={query.data.chart.revision}/>
      <PrescriptionsPanel patientId={id} identity={identity} onLock={onLock}/>
      <TreatmentPanel id={id} identity={identity} onLock={onLock}/>
      <p>{t.noBilling}</p>
    </div>
  );
}
