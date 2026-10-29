import { useState } from 'react';
import { usePatientEvents } from './usePatientEvents.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Identity, Patient } from '@clinic/contracts';
import { createPatientWorkflow } from './patient.workflow.js';
import { patientText as t } from './patient.messages.js';
import type { PatientDetails } from '@clinic/contracts';
import { patientApi } from './patient.api.js';
export function usePatients({
  identity,
  browse = true,
}: {
  identity: Identity;
  browse?: boolean;
}) {
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
    enabled: read && browse,
    gcTime: 0,
  });
  usePatientEvents(read && browse, accountKey);
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
    return result;
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
