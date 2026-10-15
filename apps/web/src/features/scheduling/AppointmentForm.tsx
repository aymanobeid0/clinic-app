import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Appointment, SchedulingChoices, SchedulingSettings } from '@clinic/contracts';
type Fields = {
  patientId: string;
  dentistId: string;
  chairId: string;
  startsAt: string;
  durationMinutes: string;
  walkIn: boolean;
  override: boolean;
};
export function AppointmentForm({
  appointment,
  choices,
  settings,
  busy,
  canOverride,
  onSubmit,
  onDirty,
}: {
  appointment: Appointment | null;
  choices: SchedulingChoices;
  settings: SchedulingSettings;
  busy: boolean;
  canOverride: boolean;
  onSubmit: (path: string, body: object) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const form = useForm<Fields>({
    defaultValues: {
      patientId: appointment?.patientId ?? '',
      dentistId: appointment?.dentistId ?? '',
      chairId: appointment?.chairId ?? '',
      startsAt: appointment?.startsAt.slice(0, 16) ?? new Date().toISOString().slice(0, 16),
      durationMinutes: String(appointment?.durationMinutes ?? settings.defaultDurationMinutes),
      walkIn: false,
      override: false,
    },
  });
  useEffect(() => onDirty?.(form.formState.isDirty), [onDirty, form.formState.isDirty]);
  return (
    <form
      onSubmit={form.handleSubmit((v) =>
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
      )}
    >
      <fieldset disabled={busy}>
        <legend>{appointment ? 'Déplacer le rendez-vous' : 'Nouveau rendez-vous'}</legend>
        {appointment ? (
          <p>
            Patient n°{appointment.patientNumber} · {appointment.patientName}
          </p>
        ) : (
          <label>
            Patient
            <select aria-label="Patient" required {...form.register('patientId')}>
              <option value="">Choisir un patient</option>
              {choices.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  n°{p.patientNumber} · {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="scheduling-grid">
          <label>
            Dentiste
            <select aria-label="Dentiste" required {...form.register('dentistId')}>
              <option value="">Choisir un dentiste</option>
              {choices.dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fauteuil (facultatif)
            <select aria-label="Fauteuil (facultatif)" {...form.register('chairId')}>
              <option value="">Sans fauteuil</option>
              {settings.chairs.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Début · heure de Nouakchott (UTC)
            <input required type="datetime-local" {...form.register('startsAt')} />
          </label>
          <label>
            Durée (minutes)
            <input
              required
              type="number"
              min="5"
              max="480"
              {...form.register('durationMinutes')}
            />
          </label>
        </div>
        <p className="hint">
          Durée par défaut : {settings.defaultDurationMinutes} min. Les suggestions du catalogue
          seront disponibles ultérieurement.
        </p>
        {!appointment && (
          <label className="check">
            <input type="checkbox" {...form.register('walkIn')} />
            Patient arrivé sans rendez-vous
          </label>
        )}
        {canOverride && (
          <label className="check">
            <input type="checkbox" {...form.register('override')} />
            Autoriser explicitement un chevauchement dentiste/fauteuil
          </label>
        )}
        <button type="submit">
          {appointment ? 'Enregistrer le déplacement' : 'Enregistrer le rendez-vous'}
        </button>
      </fieldset>
    </form>
  );
}
export function SchedulingSettingsForm({
  settings,
  busy,
  onSubmit,
}: {
  settings: SchedulingSettings;
  busy: boolean;
  onSubmit: (path: string, body: object) => void;
}) {
  const f = useForm({
    defaultValues: {
      revision: settings.revision,
      duration: String(settings.defaultDurationMinutes),
      chairs: settings.chairs.join('\n'),
    },
  });
  return (
    <details>
      <summary>Paramètres de l’agenda</summary>
      <form
        onSubmit={f.handleSubmit((v) =>
          onSubmit('/settings', {
            revision: v.revision,
            defaultDurationMinutes: Number(v.duration),
            chairs: v.chairs
              .split('\n')
              .map((c) => c.trim())
              .filter(Boolean),
          }),
        )}
      >
        <fieldset disabled={busy}>
          <legend>Paramètres de la clinique</legend>
          <label>
            Durée par défaut (minutes)
            <input type="number" required min="5" max="480" {...f.register('duration')} />
          </label>
          <label>
            Fauteuils · un nom par ligne
            <textarea rows={4} {...f.register('chairs')} />
          </label>
          <button>Enregistrer les paramètres</button>
        </fieldset>
      </form>
    </details>
  );
}
