import { useForm } from 'react-hook-form';
import type {
  ClinicalRecord,
  ClinicalContent,
  MedicalHistoryContent,
} from '@clinic/contracts';
import type { Identity } from '@clinic/contracts';
import { useClinicalSave } from './useClinicalSave.js';
export function useMedicalHistoryForm({
  id,
  record,
  identity,
  cacheKey,
  onLock,
}: {
  id: string;
  record: ClinicalRecord<ClinicalContent>;
  identity: Identity;
  cacheKey: readonly string[];
  onLock: (kind: string, locked: boolean) => void;
}) {
  const initial = record.draft ?? record.current;
  const content = initial?.content as MedicalHistoryContent | undefined;
  const form = useForm({
    defaultValues: {
      medicalHistory: content?.medicalHistory ?? '',
      allergies: content?.allergies ?? '',
      observedAt:
        initial?.observedAt.slice(0, 16) ??
        new Date().toISOString().slice(0, 16),
    },
  });
  const state = useClinicalSave(
    id,
    'history',
    record.revision,
    cacheKey,
    onLock,
    () => form.reset(form.getValues()),
  );
  const canDraft = identity.permissions.includes('history.draft');
  const submit = form.handleSubmit(async (v) => {
    if (
      await state.save(
        'draft',
        { medicalHistory: v.medicalHistory, allergies: v.allergies },
        new Date(v.observedAt + 'Z').toISOString(),
      )
    )
      form.reset(v);
  });
  return { form, state, canDraft, submit };
}
