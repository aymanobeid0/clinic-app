import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientDetailsSchema, type PatientDetails } from '@clinic/contracts';
import type { z } from 'zod';
import { HttpError } from '../identity/identity.api.js';
import { patientText as t } from './patient.messages.js';
import { serverFieldErrors } from '../../forms/fieldErrors.js';
export type PatientFormProps = {
  initial?: PatientDetails;
  blocked?: boolean;
  onSave: (details: PatientDetails, commandId: string) => Promise<unknown>;
  onError: (message: string) => void;
};
export function usePatientForm({ initial, onSave, onError }: PatientFormProps) {
  const form = useForm<
    z.input<typeof patientDetailsSchema>,
    unknown,
    PatientDetails
  >({
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
  const pending = useRef<{ details: PatientDetails; commandId: string } | null>(
    null,
  );
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
        initial
          ? details
          : { name: '', phone: '', contactKind: 'patient', contactName: '' },
      );
    } catch (error) {
      serverFieldErrors(form, error);
      const known = error instanceof HttpError && error.status < 500;
      if (known) pending.current = null;
      setUnresolved(!known);
      onError(error instanceof Error ? error.message : t.unavailable);
    } finally {
      setBusy(false);
    }
  }
  return { form, pending, busy, unresolved, kind, save };
}
