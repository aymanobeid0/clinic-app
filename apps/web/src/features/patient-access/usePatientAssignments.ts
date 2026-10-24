import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Identity, Patient } from '@clinic/contracts';
import { accessApi } from './access.api.js';
export function usePatientAssignments({ identity }: { identity: Identity }) {
  const allowed =
    identity.isManager || identity.permissions.includes('patients.assign');
  const key = `${identity.clinicId}:${identity.accountId}`;
  const cache = useQueryClient();
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState(false);
  const [offset, setOffset] = useState(0);
  const [locked, setLocked] = useState(false);
  const [selected, setSelected] = useState<Pick<
    Patient,
    'id' | 'name' | 'patientNumber'
  > | null>(null);
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
  return {
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
  };
}
