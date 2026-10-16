import { clinicalMessages as t } from './clinical.messages.js';
import { useForm } from 'react-hook-form';
import type {
  ClinicalRecord,
  ClinicalContent,
  MedicalHistoryContent,
} from '@clinic/contracts';
import type { Identity } from '@clinic/contracts';
import { useClinicalSave } from './useClinicalSave.js';
import { ClinicalActions } from './ClinicalActions.js';
export function HistoryForm({
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
  return (
    <form
      aria-label={t.history}
      onSubmit={form.handleSubmit(async (v) => {
        if (
          await state.save(
            'draft',
            { medicalHistory: v.medicalHistory, allergies: v.allergies },
            new Date(v.observedAt + 'Z').toISOString(),
          )
        )
          form.reset(v);
      })}
    >
      <fieldset disabled={!canDraft || state.busy || state.uncertain}>
        <label>
          {t.observedDate}
          <input
            type="datetime-local"
            required
            {...form.register('observedAt')}
          />
        </label>
        <label>
          {t.medicalHistory}
          <textarea maxLength={8000} {...form.register('medicalHistory')} />
        </label>
        <label>
          {t.allergies}
          <textarea maxLength={4000} {...form.register('allergies')} />
        </label>
      </fieldset>
      <p>{t.emptyAllergy}</p>
      <ClinicalActions
        state={state}
        canDraft={canDraft}
        canConfirm={
          identity.kind === 'doctor' &&
          identity.permissions.includes('history.finalize')
        }
        hasDraft={!!record.draft}
        draftRevision={record.draft?.revision}
        dirty={form.formState.isDirty}
      />
    </form>
  );
}
