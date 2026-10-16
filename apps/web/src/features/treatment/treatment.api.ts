import type { Catalog, TreatmentPlan } from '@clinic/contracts';
import { HttpError, post } from '../identity/identity.api.js';
export async function treatmentGet<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch(`/api/${path}`, { cache: 'no-store', signal });
  const data = await r.json();
  if (!r.ok)
    throw new HttpError(
      r.status,
      data.error ?? 'Service indisponible. Réessayez.',
    );
  return data;
}
export const treatmentApi = {
  catalog: (signal?: AbortSignal) => treatmentGet<Catalog>('catalog', signal),
  plans: (id: string, signal?: AbortSignal) =>
    treatmentGet<TreatmentPlan[]>(`treatment/${id}/plans`, signal),
  save: (path: string, data: object) => post<TreatmentPlan>(path, data),
};
export function formatMinor(value: string, precision: number) {
  const s = value.padStart(precision + 1, '0');
  return precision ? `${s.slice(0, -precision)}.${s.slice(-precision)}` : s;
}
