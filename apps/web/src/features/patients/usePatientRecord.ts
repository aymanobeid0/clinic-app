import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Patient } from '@clinic/contracts';
import { patientApi } from './patient.api.js';
import { createPatientWorkflow } from './patient.workflow.js';
import { HttpError } from '../identity/identity.api.js';
import { patientText as t } from './patient.messages.js';
export function usePatientRecord({
  id,
  accountKey,
  onError,
  onNotice,
  onClose,
}: {
  id: string;
  accountKey: string;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
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
  const patient = current.data!;
  async function status(confirmed: boolean) {
    if (busy || (!statusRequest.current && (!patient || current.error))) return;
    if (!statusRequest.current) {
      if (!confirmed) return;
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
      await createPatientWorkflow(cache).status(
        request.patient,
        request.action,
        request.commandId,
      );
      onNotice(
        request.action === 'archive' ? 'Patient archivé.' : 'Patient réactivé.',
      );
      statusRequest.current = null;
      onClose();
    } catch (error) {
      if (error instanceof HttpError && error.status < 500)
        statusRequest.current = null;
      onError(error instanceof Error ? error.message : t.unavailable);
    } finally {
      setBusy(false);
    }
  }
  return { current, history, busy, statusRequest, patient, status };
}
