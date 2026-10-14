import type { Patient, PatientDetails, PatientHistory } from '@clinic/contracts';
import { post, HttpError } from '../identity/identity.api.js';
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/patients${path}`, {
    cache: 'no-store',
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new HttpError(response.status, data.error ?? 'Patients indisponibles. Réessayez.');
  return data;
}
export const patientApi = {
  search: (q: string, archived: boolean, offset: number, signal?: AbortSignal) =>
    get<{ patients: Patient[] }>(
      `?${new URLSearchParams({ q, archived: String(archived), offset: String(offset) })}`,
      signal,
    ),
  get: (id: string, signal?: AbortSignal) => get<Patient>(`/${id}`, signal),
  history: (id: string, signal?: AbortSignal) => get<PatientHistory[]>(`/${id}/history`, signal),
  register: (details: PatientDetails, commandId: string) =>
    post<{
      patient: Patient;
      duplicateWarning: boolean;
      duplicates: Patient[];
    }>('patients', { ...details, commandId }),
  edit: (id: string, details: PatientDetails, commandId: string, revision: number) =>
    post<Patient>(`patients/${id}/contact`, {
      ...details,
      commandId,
      revision,
    }),
  status: (patient: Patient, action: 'archive' | 'reactivate', commandId: string) =>
    post<Patient>(`patients/${patient.id}/${action}`, {
      revision: patient.revision,
      commandId,
    }),
};
