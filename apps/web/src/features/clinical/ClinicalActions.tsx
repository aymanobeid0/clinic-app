import type { ClinicalSave } from './useClinicalSave.js';
import { clinicalMessages as t } from './clinical.messages.js';
export function ClinicalActions({
  state,
  canDraft,
  canConfirm,
  hasDraft,
  dirty,
  draftRevision,
}: {
  state: ClinicalSave;
  canDraft: boolean;
  canConfirm: boolean;
  hasDraft: boolean;
  dirty: boolean;
  draftRevision?: number;
}) {
  return (
    <>
      {dirty && <p role="status">{t.unsaved}</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {state.notice && <p role="status">{state.notice}</p>}
      {canDraft && !state.uncertain && (
        <button type="submit" disabled={state.busy}>
          {state.busy ? t.saving : t.save}
        </button>
      )}
      {state.uncertain && (
        <button
          type="button"
          disabled={state.busy}
          onClick={() => void state.retry()}
        >
          {t.retry}
        </button>
      )}
      {canConfirm && hasDraft && !state.uncertain && (
        <button
          type="button"
          disabled={state.busy || dirty || state.revision !== draftRevision}
          onClick={() => {
            if (confirm(t.confirmQuestion(draftRevision!)))
              void state.save('confirm');
          }}
        >
          {t.confirm} {draftRevision}
        </button>
      )}
      <button
        type="button"
        disabled={state.busy || state.uncertain}
        onClick={() => void state.reconcile()}
      >
        {t.reconcile}
      </button>
    </>
  );
}
