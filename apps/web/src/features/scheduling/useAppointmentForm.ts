import { useQuery } from '@tanstack/react-query';
import { schedulingApi } from './scheduling.api.js';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type {
  Appointment,
  SchedulingChoices,
  SchedulingSettings,
} from '@clinic/contracts';
type Fields = {
  patientId: string;
  dentistId: string;
  chairId: string;
  startsAt: string;
  durationMinutes: string;
  walkIn: boolean;
  override: boolean;
};
export function useAppointmentForm({
  appointment,
  scope,
  settings,
  onSubmit,
  onDirty,
}: {
  appointment: Appointment | null;
  scope: string[];
  choices: SchedulingChoices;
  settings: SchedulingSettings;
  busy: boolean;
  canOverride: boolean;
  onSubmit: (path: string, body: object) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const suggestions = useQuery({
    queryKey: [...scope, 'suggestions'],
    queryFn: ({ signal }) => schedulingApi.suggestions(signal),
    gcTime: 0,
  });
  const [suggestion, setSuggestion] = useState('');
  const [chosenPatient, setChosenPatient] = useState<
    SchedulingChoices['patients'][number] | undefined
  >();
  const form = useForm<Fields>({
    defaultValues: {
      patientId: appointment?.patientId ?? '',
      dentistId: appointment?.dentistId ?? '',
      chairId: appointment?.chairId ?? '',
      startsAt:
        appointment?.startsAt.slice(0, 16) ??
        new Date().toISOString().slice(0, 16),
      durationMinutes: String(
        appointment?.durationMinutes ?? settings.defaultDurationMinutes,
      ),
      walkIn: false,
      override: false,
    },
  });
  useEffect(
    () => onDirty?.(form.formState.isDirty),
    [onDirty, form.formState.isDirty],
  );
  const submit = form.handleSubmit((v) =>
    onSubmit(appointment ? `/${appointment.id}/reschedule` : '', {
      ...(appointment
        ? { revision: appointment.revision }
        : { patientId: v.patientId, walkIn: v.walkIn }),
      dentistId: v.dentistId,
      chairId: v.chairId || null,
      startsAt: `${v.startsAt}:00Z`,
      durationMinutes: Number(v.durationMinutes),
      override: v.override,
    }),
  );
  function applySuggestion() {
    const item = suggestions.data?.suggestions.find(
      (item) => item.procedureId === suggestion,
    );
    if (item)
      form.setValue('durationMinutes', String(item.durationMinutes), {
        shouldDirty: true,
      });
  }
  return {
    submit,
    applySuggestion,
    suggestions,
    suggestion,
    setSuggestion,
    chosenPatient,
    setChosenPatient,
    form,
  };
}
