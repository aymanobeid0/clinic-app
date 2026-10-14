import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientDetailsSchema, type PatientDetails } from '@clinic/contracts';
import type { z } from 'zod';
import { Field } from '../identity/components/Field.js';
import { HttpError } from '../identity/identity.api.js';
import { patientText as t } from './patient.messages.js';
type Props = {
  initial?: PatientDetails;
  blocked?: boolean;
  onSave: (details: PatientDetails, commandId: string) => Promise<void>;
  onError: (message: string) => void;
};
export function PatientForm({ initial, blocked, onSave, onError }: Props) {
  const form = useForm<z.input<typeof patientDetailsSchema>, unknown, PatientDetails>({
    resolver: zodResolver(patientDetailsSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          phone: initial.phone,
          contactKind: initial.contactKind,
          contactName: initial.contactName,
        }
      : { name: '', phone: '', contactKind: 'patient', contactName: '' },
  });
  const pending = useRef<{ details: PatientDetails; commandId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unresolved, setUnresolved] = useState(false);
  const kind = form.watch('contactKind');
  async function save(details: PatientDetails) {
    pending.current ??= { details, commandId: crypto.randomUUID() };
    setBusy(true);
    try {
      await onSave(pending.current.details, pending.current.commandId);
      pending.current = null;
      setUnresolved(false);
      form.reset(
        initial ? details : { name: '', phone: '', contactKind: 'patient', contactName: '' },
      );
    } catch (error) {
      const known = error instanceof HttpError && error.status < 500;
      if (known) pending.current = null;
      setUnresolved(!known);
      onError(error instanceof Error ? error.message : t.unavailable);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      aria-label={initial ? t.contactForm : t.register}
      onSubmit={form.handleSubmit(save, () =>
        onError('Vérifiez le nom, le téléphone et le contact.'),
      )}
    >
      <h4>{initial ? t.contactForm : t.register}</h4>
      <fieldset disabled={busy || unresolved || blocked} className="patient-fields">
        <Field label={t.name}>
          <input {...form.register('name')} required maxLength={120} />
        </Field>
        <Field label={t.phone}>
          <input type="tel" {...form.register('phone')} required maxLength={64} />
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
          Patient archivé : votre saisie reste conservée. Réactivez le dossier avant modification.
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
