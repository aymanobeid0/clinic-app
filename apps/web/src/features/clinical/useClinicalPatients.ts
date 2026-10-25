import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Identity } from '@clinic/contracts';
import { clinicalApi } from './clinical.api.js';
export function useClinicalPatients(identity: Identity) {
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
    // Each connection receives an authorized initial invalidate.
    stream.onerror = refresh;
    return () => {
      stream.close();
      void cache.cancelQueries({ queryKey: ['clinical-patients', key] });
      cache.removeQueries({ queryKey: ['clinical-patients', key] });
    };
  }, [allowed, key, cache]);
  const visiblePatients = patients.data?.filter((patient) =>
    `${patient.patientNumber} ${patient.name}`
      .toLocaleLowerCase('fr')
      .includes(search.toLocaleLowerCase('fr')),
  );
  return {
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
  };
}
