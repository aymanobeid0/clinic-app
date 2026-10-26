import { FormErrors } from "../../forms/FormErrors.js";
import { ValidatedForm } from "../../forms/ValidatedForm.js";
import type { UseFormReturn } from 'react-hook-form';
import type {
  ClinicalContent,
  ClinicalRecord,
  Identity,
} from '@clinic/contracts';
import {
  useChartForm,
  useToothEditor,
  type ChartValues,
} from './useChartForm.js';
import { ClinicalActions } from './ClinicalActions.js';
import { clinicalMessages as t } from './clinical.messages.js';
export function ChartForm({
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
  const {
    form,
    state,
    canDraft,
    selected,
    codes,
    teeth,
    index,
    select,
    submit,
    removeTooth,
  } = useChartForm({ id, record, identity, cacheKey, onLock });
  return (
    <ValidatedForm aria-label={t.chart} onSubmit={submit}>
      <fieldset disabled={!canDraft || state.busy || state.uncertain}>
        <label>
          {t.chartDate}
          <input
            type="datetime-local"
            required
            {...form.register('observedAt')}
          />
        </label>
        <label>
          {t.dentition}
          <select aria-label={t.dentition} {...form.register('dentition')}>
            <option value="permanent">{t.dentitions.permanent}</option>
            <option value="primary">{t.dentitions.primary}</option>
            <option value="mixed">{t.dentitions.mixed}</option>
          </select>
        </label>
        <p>{t.fdiHint}</p>
        <label>
          {t.otherNotes}
          <textarea maxLength={4000} {...form.register('otherNotes')} />
        </label>
        <div className="tooth-grid" role="group" aria-label={t.positions}>
          {codes.map((code) => (
            <button
              type="button"
              key={code}
              aria-pressed={selected === code}
              onClick={() => select(code)}
            >
              {code}
              <small>
                {
                  t.presence[
                    teeth.find((t) => t.tooth === code)?.presence ?? 'unknown'
                  ]
                }
              </small>
            </button>
          ))}
        </div>
        {index >= 0 && (
          <ToothEditor
            key={selected}
            form={form}
            index={index}
            onRemove={removeTooth}
          />
        )}
      </fieldset>
      <ClinicalActions
        state={state}
        canDraft={canDraft}
        canConfirm={
          identity.kind === 'doctor' &&
          identity.permissions.includes('chart.finalize')
        }
        hasDraft={!!record.draft}
        draftRevision={record.draft?.revision}
        dirty={form.formState.isDirty}
      />
    <FormErrors errors={form.formState.errors} />
</ValidatedForm>
  );
}
function ToothEditor({
  form,
  index,
  onRemove,
}: {
  form: UseFormReturn<ChartValues>;
  index: number;
  onRemove: () => void;
}) {
  const { conditions, tooth, anterior, addFinding } = useToothEditor(
    form,
    index,
  );
  return (
    <section aria-label={t.tooth(tooth)} className="tooth-editor">
      <h5>{t.tooth(tooth)}</h5>
      <label>
        {t.presenceLabel}
        <select
          aria-label={t.presenceLabel}
          {...form.register(`teeth.${index}.presence`)}
        >
          {Object.entries(t.presence).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          {...form.register(`teeth.${index}.extractionHistory`)}
        />
        {t.extracted}
      </label>
      <fieldset>
        <legend>{t.existingTreatments}</legend>
        {Object.entries(t.treatments).map(([value, label]) => (
          <label className="check" key={value}>
            <input
              type="checkbox"
              value={value}
              {...form.register(`teeth.${index}.treatments`)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {conditions.fields.map((c, n) => (
        <fieldset key={c.id}>
          <legend>{t.finding(n + 1)}</legend>
          <label>
            {t.findingLabel}
            <select
              aria-label={t.findingLabel}
              {...form.register(`teeth.${index}.conditions.${n}.finding`)}
            >
              {Object.entries(t.findings).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>{t.surfaceHint}</legend>
            {(
              [
                'mesial',
                'distal',
                'outer',
                'inner',
                anterior ? 'incisal' : 'occlusal',
              ] as const
            ).map((value) => (
              <label className="check" key={value}>
                <input
                  type="checkbox"
                  value={value}
                  {...form.register(`teeth.${index}.conditions.${n}.surfaces`)}
                />
                {value === 'outer'
                  ? t.outerLabel(anterior)
                  : value === 'inner'
                    ? t.innerLabel([1, 2, 5, 6].includes(Number(tooth[0])))
                    : t.surfaces[value]}
              </label>
            ))}
          </fieldset>
          <label>
            {t.note}
            <textarea
              maxLength={1000}
              {...form.register(`teeth.${index}.conditions.${n}.note`)}
            />
          </label>
          <button type="button" onClick={() => conditions.remove(n)}>
            {t.removeFinding(n + 1)}
          </button>
        </fieldset>
      ))}
      <button type="button" onClick={addFinding}>
        {t.addFinding}
      </button>
      <button type="button" onClick={onRemove}>
        {t.removeTooth}
      </button>
    </section>
  );
}
