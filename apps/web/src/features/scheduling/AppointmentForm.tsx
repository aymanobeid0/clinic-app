import { FormErrors } from "../../forms/FormErrors.js";
import { ValidatedForm } from "../../forms/ValidatedForm.js";
import { useAppointmentForm } from './useAppointmentForm.js';
import { useSchedulingSettingsForm } from './useSchedulingSettingsForm.js';
import type {
  Appointment,
  SchedulingChoices,
  SchedulingSettings,
} from '@clinic/contracts';
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
  scope: string[];
  choices: SchedulingChoices;
  settings: SchedulingSettings;
  busy: boolean;
  canOverride: boolean;
  onSubmit: (path: string, body: object) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const {
    submit,
    applySuggestion,
    suggestions,
    suggestion,
    setSuggestion,
    chosenPatient,
    setChosenPatient,
    form,
  } = useAppointmentForm({
    appointment,
    scope,
    choices,
    settings,
    busy,
    canOverride,
    onSubmit,
    onDirty,
  });
  return (
    <ValidatedForm onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>
          {appointment ? 'Déplacer le rendez-vous' : 'Nouveau rendez-vous'}
        </legend>
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
                  setChosenPatient(
                    choices.patients.find((p) => p.id === e.target.value),
                  ),
              })}
            >
              <option value="">Choisir un patient</option>
              {(chosenPatient &&
              !choices.patients.some((p) => p.id === chosenPatient.id)
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
            <select
              aria-label="Dentiste"
              required
              {...form.register('dentistId')}
            >
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
            <select
              aria-label="Fauteuil (facultatif)"
              {...form.register('chairId')}
            >
              <option value="">Sans fauteuil</option>
              {settings.chairs.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Début · heure de Nouakchott (UTC)
            <input
              required
              type="datetime-local"
              {...form.register('startsAt')}
            />
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
          Durée par défaut : {settings.defaultDurationMinutes} min. La durée
          reste modifiable manuellement.
        </p>
        {suggestions.error && <p role="alert">{suggestions.error.message}</p>}
        {suggestions.data?.available && (
          <div>
            <label>
              Suggestion du catalogue
              <select
                aria-label="Suggestion du catalogue"
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
              >
                <option value="">Choisir une durée suggérée</option>
                {suggestions.data.suggestions.map((s) => (
                  <option key={s.procedureId} value={s.procedureId}>
                    {s.label} · {s.durationMinutes} min
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!suggestion}
              onClick={applySuggestion}
            >
              Appliquer cette durée
            </button>
          </div>
        )}
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
          {appointment
            ? 'Enregistrer le déplacement'
            : 'Enregistrer le rendez-vous'}
        </button>
      </fieldset>
    <FormErrors errors={form.formState.errors} />
</ValidatedForm>
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
  const { f, submit } = useSchedulingSettingsForm(settings, onSubmit);
  return (
    <details>
      <summary>Paramètres de l’agenda</summary>
      <ValidatedForm onSubmit={submit}>
        <fieldset disabled={busy}>
          <legend>Paramètres de la clinique</legend>
          <label>
            Durée par défaut (minutes)
            <input
              type="number"
              required
              min="5"
              max="480"
              {...f.register('duration')}
            />
          </label>
          <label>
            Fauteuils · un nom par ligne
            <textarea rows={4} {...f.register('chairs')} />
          </label>
          <button>Enregistrer les paramètres</button>
        </fieldset>
      <FormErrors errors={f.formState.errors} />
</ValidatedForm>
    </details>
  );
}
