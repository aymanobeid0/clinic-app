import { clinicalMessages as t } from './clinical.messages.js';
import type { ClinicalRecord, ClinicalContent } from '@clinic/contracts';
import type { Identity } from '@clinic/contracts';
import { useMedicalHistoryForm } from './useMedicalHistoryForm.js';
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
  const { form, state, canDraft, submit } = useMedicalHistoryForm({
    id,
    record,
    identity,
    cacheKey,
    onLock,
  });
  return (
    <form aria-label={t.history} onSubmit={submit}>
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
