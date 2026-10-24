import type { QueryClient } from '@tanstack/react-query';
import type { Patient, PatientDetails } from '@clinic/contracts';
import { patientApi } from './patient.api.js';
import { createIdentityWorkflow } from '../identity/identity.workflow.js';

export function createPatientWorkflow(cache: QueryClient) {
  async function change<T>(command: () => Promise<T>): Promise<T> {
    try {
      const result = await command();
      await cache.invalidateQueries({
        predicate: ({ queryKey }) =>
          queryKey[0] === 'patients' ||
          (queryKey[0] === 'patient-access' && queryKey[2] === 'patients') ||
          (queryKey[0] === 'scheduling' &&
            ['choices', 'agenda'].includes(String(queryKey[3]))),
      });
      return result;
    } catch (error) {
      await createIdentityWorkflow(cache).reconcileDenied(error);
      throw error;
    }
  }
  return {
    register: (details: PatientDetails, commandId: string) =>
      change(() => patientApi.register(details, commandId)),
    edit: (
      id: string,
      details: PatientDetails,
      commandId: string,
      revision: number,
    ) => change(() => patientApi.edit(id, details, commandId, revision)),
    status: (
      patient: Patient,
      action: 'archive' | 'reactivate',
      commandId: string,
    ) => change(() => patientApi.status(patient, action, commandId)),
  };
}
