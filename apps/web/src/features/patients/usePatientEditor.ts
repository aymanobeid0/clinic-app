import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Patient } from '@clinic/contracts';
import { patientApi } from './patient.api.js';
import { createPatientWorkflow } from './patient.workflow.js';
import { patientText as t } from './patient.messages.js';
import type { PatientDetails } from '@clinic/contracts';
export function usePatientEditor({
  patient,
  accountKey,
  onError,
  onNotice,
}: {
  patient: Patient;
  accountKey: string;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const cache = useQueryClient();
  const [revision, setRevision] = useState(patient.revision);
  const submitted = useRef<{ commandId: string; revision: number } | null>(
    null,
  );
  const [reconciled, setReconciled] = useState(false);
  async function save(details: PatientDetails, commandId: string) {
    onError('');
    onNotice('');
    if (submitted.current?.commandId !== commandId)
      submitted.current = { commandId, revision };
    const result = await createPatientWorkflow(cache).edit(
      patient.id,
      details,
      commandId,
      submitted.current.revision,
    );
    setRevision(result.revision);
    onNotice('Coordonnées enregistrées.');
  }
  async function reload() {
    try {
      const latest = await patientApi.get(patient.id);
      cache.setQueryData(
        ['patients', accountKey, 'record', patient.id],
        latest,
      );
      setRevision(latest.revision);
      setReconciled(true);
    } catch (error) {
      onError(error instanceof Error ? error.message : t.unavailable);
    }
  }
  return { reconciled, save, reload };
}
