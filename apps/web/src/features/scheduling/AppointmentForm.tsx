import {useQuery} from '@tanstack/react-query';
import {schedulingApi} from './scheduling.api.js';
import { useEffect, useState } from 'react';
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
  scope,
  choices,
  settings,
  busy,
  canOverride,
  onSubmit,
  onDirty,
}: {
  appointment: Appointment | null;
  scope:string[];
  choices: SchedulingChoices;
  settings: SchedulingSettings;
  busy: boolean;
  canOverride: boolean;
  onSubmit: (path: string, body: object) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const suggestions=useQuery({queryKey:[...scope,'suggestions'],queryFn:({signal})=>schedulingApi.suggestions(signal),gcTime:0});
  const [suggestion,setSuggestion]=useState('');
  const [chosenPatient, setChosenPatient] = useState<
    SchedulingChoices['patients'][number] | undefined
  >();
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
            <select
              aria-label="Patient"
              required
              {...form.register('patientId', {
                onChange: (e) =>
                  setChosenPatient(choices.patients.find((p) => p.id === e.target.value)),
              })}
            >
              <option value="">Choisir un patient</option>
              {(chosenPatient && !choices.patients.some((p) => p.id === chosenPatient.id)
                ? [chosenPatient, ...choices.patients]
                : choices.patients
              ).map((p) => (
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
          Durée par défaut : {settings.defaultDurationMinutes} min. La durée reste modifiable manuellement.
        </p>
        {suggestions.error&&<p role="alert">{suggestions.error.message}</p>}
        {suggestions.data?.available&&<div><label>Suggestion du catalogue<select aria-label="Suggestion du catalogue" value={suggestion} onChange={e=>setSuggestion(e.target.value)}><option value="">Choisir une durée suggérée</option>{suggestions.data.suggestions.map(s=><option key={s.procedureId} value={s.procedureId}>{s.label} · {s.durationMinutes} min</option>)}</select></label><button type="button" disabled={!suggestion} onClick={()=>{const s=suggestions.data.suggestions.find(s=>s.procedureId===suggestion);if(s)form.setValue('durationMinutes',String(s.durationMinutes),{shouldDirty:true});}}>Appliquer cette durée</button></div>}
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
