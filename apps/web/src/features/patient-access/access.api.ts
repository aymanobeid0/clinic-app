import type {
  Patient,
  PatientAccess,
  AssignmentCandidate,
  PatientAccessEvent,
} from '@clinic/contracts';
import { post, HttpError } from '../identity/identity.api.js';
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(`/api/${path}`, { cache: 'no-store', signal });
  const data = await r.json();
  if (!r.ok) throw new HttpError(r.status, data.error ?? 'Accès indisponible.');
  return data;
}
export const accessApi = {
  patients: (q: string, archived: boolean, offset: number, signal?: AbortSignal) =>
    get<{ patients: Patient[] }>(
      `assignment-patients?${new URLSearchParams({ q, archived: String(archived), offset: String(offset) })}`,
      signal,
    ),
  candidates: (signal?: AbortSignal) =>
    get<AssignmentCandidate[]>('patient-access/candidates', signal),
  get: (id: string, signal?: AbortSignal) => get<PatientAccess>(`patient-access/${id}`, signal),
  history: (id: string, signal?: AbortSignal) =>
    get<PatientAccessEvent[]>(`patient-access/${id}/history`, signal),
  share: (
    id: string,
    data: {
      accountId: string;
      kind: 'assigned' | 'shared';
      commandId: string;
      revision: number;
    },
  ) => post<PatientAccess>(`patient-access/${id}/share`, data),
  remove: (id: string, data: { accountId: string; commandId: string; revision: number }) =>
    post<PatientAccess>(`patient-access/${id}/remove`, data),
};
