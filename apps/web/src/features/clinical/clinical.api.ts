import type {
  ClinicalWorkspace,
  ClinicalRecord,
  ClinicalContent,
} from '@clinic/contracts';
import { post, HttpError } from '../identity/identity.api.js';
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/${path}`, { cache: 'no-store', signal });
  const body = await response.json();
  if (!response.ok)
    throw new HttpError(
      response.status,
      body.error ?? 'Dossier indisponible. Réessayez.',
    );
  return body;
}
export const clinicalApi = {
  patients: (signal?: AbortSignal) =>
    get<{ id: string; name: string; patientNumber: number }[]>(
      'clinical-patients',
      signal,
    ),
  get: (id: string, signal?: AbortSignal) =>
    get<ClinicalWorkspace>(`clinical/${id}`, signal),
  save: (id: string, kind: string, action: string, data: object) =>
    post<ClinicalRecord<ClinicalContent>>(
      `clinical/${id}/${kind}/${action}`,
      data,
    ),
};
