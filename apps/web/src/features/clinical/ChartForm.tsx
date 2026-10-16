import { useState } from 'react';
import { useForm, useFieldArray, type UseFormReturn } from 'react-hook-form';
import type {
  ChartContent,
  ClinicalContent,
  ClinicalRecord,
  Identity,
} from '@clinic/contracts';
import { useClinicalSave } from './useClinicalSave.js';
import { ClinicalActions } from './ClinicalActions.js';
import { clinicalMessages as t } from './clinical.messages.js';
type Values = ChartContent & { observedAt: string };
const positions = (primary: boolean) =>
  [...(primary ? [5, 6, 7, 8] : [1, 2, 3, 4])].flatMap((q) =>
    Array.from({ length: primary ? 5 : 8 }, (_, i) => `${q}${i + 1}`),
  );
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
  const initial = record.draft ?? record.current;
  const form = useForm<Values>({
    defaultValues: {
      numberingScheme: 'FDI',
      dentition: 'permanent',
      teeth: [],
      otherNotes: '',
      ...(initial?.content as ChartContent | undefined),
      observedAt:
        initial?.observedAt.slice(0, 16) ??
        new Date().toISOString().slice(0, 16),
    },
  });
  const [selected, setSelected] = useState<string>('');
  const mode = form.watch('dentition');
  const teeth = form.watch('teeth');
  const index = teeth.findIndex((t) => t.tooth === selected);
  const state = useClinicalSave(
    id,
    'chart',
    record.revision,
    cacheKey,
    onLock,
    () => form.reset(form.getValues()),
  );
  const canDraft = identity.permissions.includes('chart.draft');
  const codes = [
    ...(mode !== 'primary' ? positions(false) : []),
    ...(mode !== 'permanent' ? positions(true) : []),
  ];
  function select(code: string) {
    if (!teeth.some((t) => t.tooth === code))
      form.setValue(
        'teeth',
        [
          ...teeth,
          {
            tooth: code,
            presence: 'unknown',
            extractionHistory: false,
            conditions: [],
            treatments: [],
          },
        ],
        { shouldDirty: true },
      );
    setSelected(code);
  }
  return (
    <form
      aria-label={t.chart}
      onSubmit={form.handleSubmit(async (v) => {
        const { observedAt, ...content } = v;
        if (
          await state.save(
            'draft',
            content,
            new Date(observedAt + 'Z').toISOString(),
          )
        )
          form.reset(v);
      })}
    >
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
            onRemove={() => {
              form.setValue(
                'teeth',
                teeth.filter((t) => t.tooth !== selected),
                { shouldDirty: true },
              );
              setSelected('');
            }}
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
    </form>
  );
}
function ToothEditor({
  form,
  index,
  onRemove,
}: {
  form: UseFormReturn<Values>;
  index: number;
  onRemove: () => void;
}) {
  const conditions = useFieldArray({
    control: form.control,
    name: `teeth.${index}.conditions`,
  });
  const tooth = form.watch(`teeth.${index}.tooth`);
  const anterior = Number(tooth[1]) <= 3;
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
      <button
        type="button"
        onClick={() =>
          conditions.append({ finding: 'other', surfaces: [], note: '' })
        }
      >
        {t.addFinding}
      </button>
      <button type="button" onClick={onRemove}>
        {t.removeTooth}
      </button>
    </section>
  );
}
