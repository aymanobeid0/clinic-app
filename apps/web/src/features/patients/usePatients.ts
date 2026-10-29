import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Identity, Patient } from '@clinic/contracts';
import { createPatientWorkflow } from './patient.workflow.js';
import { patientText as t } from './patient.messages.js';
import type { PatientDetails } from '@clinic/contracts';
import { patientApi } from './patient.api.js';
export function usePatients({ identity }: { identity: Identity }) {
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
  async function register(details: PatientDetails, commandId: string) {
    setError('');
    setNotice('');
    const result = await createPatientWorkflow(cache).register(
      details,
      commandId,
    );
    setNotice(
      result.duplicateWarning
        ? t.duplicate
        : t.registered(result.patient.patientNumber),
    );
    setDuplicates(result.duplicates);
  }
  return {
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
  };
}
