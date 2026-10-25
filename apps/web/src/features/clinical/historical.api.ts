import {
  historicalGrantSchema,
  revokePatientSchema,
  type HistoricalSnapshot,
  type PatientAccess,
} from '@clinic/contracts';
import type { z } from 'zod';
import { HttpError, post } from '../identity/identity.api.js';
export type HistoricalPatient = {
  id: string;
  name: string;
  patientNumber: number;
  cutoff: string;
};
async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/${path}`, { signal, cache: 'no-store' });
  if (!response.ok) {
    const data = await response.json();
    throw new HttpError(
      response.status,
      data.error ?? 'Historique indisponible.',
    );
  }
  return response.json();
}
export const historicalApi = {
  grant: (patientId: string, input: z.input<typeof historicalGrantSchema>) =>
    post<PatientAccess>(
      `patient-access/${encodeURIComponent(patientId)}/historical`,
      historicalGrantSchema.parse(input),
    ),
  revoke: (patientId: string, input: z.input<typeof revokePatientSchema>) =>
    post<PatientAccess>(
      `patient-access/${encodeURIComponent(patientId)}/revoke`,
      revokePatientSchema.parse(input),
    ),
  patients: (signal?: AbortSignal) =>
    read<HistoricalPatient[]>('historical', signal),
  snapshot: (id: string, signal?: AbortSignal) =>
    read<HistoricalSnapshot>(`historical/${encodeURIComponent(id)}`, signal),
  async attachment(
    patientId: string,
    id: string,
    revision: number,
    signal?: AbortSignal,
  ) {
    const response = await fetch(
      `/api/historical/${encodeURIComponent(patientId)}/attachments/${encodeURIComponent(id)}/versions/${revision}/content?output=inline`,
      { signal, cache: 'no-store' },
    );
    if (!response.ok) {
      const data = await response.json();
      throw new HttpError(
        response.status,
        data.error ?? 'Version historique indisponible.',
      );
    }
    return response.blob();
  },
};
