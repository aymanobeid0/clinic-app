import { usePatientForm, type PatientFormProps } from './usePatientForm.js';
import { Field } from '../identity/components/Field.js';
import { patientText as t } from './patient.messages.js';
export function PatientForm({
  initial,
  blocked,
  onSave,
  onError,
}: PatientFormProps) {
  const { form, pending, busy, unresolved, kind, save } = usePatientForm({
    initial,
    blocked,
    onSave,
    onError,
  });
  return (
    <form
      aria-label={initial ? t.contactForm : t.register}
      onSubmit={form.handleSubmit(save, () =>
        onError('Vérifiez le nom, le téléphone et le contact.'),
      )}
    >
      <h4>{initial ? t.contactForm : t.register}</h4>
      <fieldset
        disabled={busy || unresolved || blocked}
        className="patient-fields"
      >
        <Field label={t.name}>
          <input {...form.register('name')} required maxLength={120} />
        </Field>
        <Field label={t.phone}>
          <input
            type="tel"
            {...form.register('phone')}
            required
            maxLength={64}
          />
        </Field>
        <Field label={t.contactKind}>
          <select {...form.register('contactKind')}>
            <option value="patient">{t.patient}</option>
            <option value="guardian">{t.guardian}</option>
          </select>
        </Field>
        {kind === 'guardian' && (
          <Field label={t.contactName}>
            <input {...form.register('contactName')} required maxLength={120} />
          </Field>
        )}
      </fieldset>
      {form.formState.isDirty && <p>{t.draft}</p>}
      {blocked && (
        <p role="status">
          Patient archivé : votre saisie reste conservée. Réactivez le dossier
          avant modification.
        </p>
      )}
      {unresolved && <p role="status">{t.unresolved}</p>}
      <button
        disabled={busy || blocked}
        type={unresolved ? 'button' : 'submit'}
        onClick={
          unresolved
            ? () => {
                if (pending.current) void save(pending.current.details);
              }
            : undefined
        }
      >
        {busy ? t.saving : unresolved ? t.retry : initial ? t.save : t.create}
      </button>
    </form>
  );
}
