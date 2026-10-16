import type {
  ProcedureDurationSuggestion,
  Appointment,
  AppointmentHistory,
  SchedulingChoices,
  SchedulingSettings,
} from '@clinic/contracts';
import { HttpError, post } from '../identity/identity.api.js';
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/appointments${path}`, {
    cache: 'no-store',
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new HttpError(response.status, data.error ?? 'Agenda indisponible. Réessayez.');
  return data;
}
export const schedulingApi = {
  suggestions:(signal?:AbortSignal)=>get<{available:boolean;suggestions:ProcedureDurationSuggestion[]}>('/suggestions',signal),
  agenda: (date: string, dentistId: string, signal?: AbortSignal) =>
    get<{ appointments: Appointment[] }>(
      `?${new URLSearchParams({ date, ...(dentistId ? { dentistId } : {}) })}`,
      signal,
    ),
  choices: (q: string, signal?: AbortSignal) =>
    get<SchedulingChoices>(`/choices?${new URLSearchParams({ q })}`, signal),
  settings: (signal?: AbortSignal) => get<SchedulingSettings>('/settings', signal),
  history: (id: string, signal?: AbortSignal) =>
    get<AppointmentHistory[]>(`/${id}/history`, signal),
  command: (path: string, body: object) =>
    post<Appointment | SchedulingSettings>(`appointments${path}`, body),
};
export const statusLabels = {
  booked: 'Réservé',
  confirmed: 'Confirmé',
  arrived: 'Arrivé',
  in_care: 'En soins',
  completed: 'Terminé',
  cancelled: 'Annulé',
  no_show: 'Absent',
};
