import { useState } from 'react';
import { useForm, useFieldArray, type UseFormReturn } from 'react-hook-form';
import type {
  ChartContent,
  ClinicalContent,
  ClinicalRecord,
  Identity,
} from '@clinic/contracts';
import { useClinicalSave } from './useClinicalSave.js';
export type ChartValues = ChartContent & { observedAt: string };
export function useToothEditor(
  form: UseFormReturn<ChartValues>,
  index: number,
) {
  const conditions = useFieldArray({
    control: form.control,
    name: `teeth.${index}.conditions`,
  });
  const tooth = form.watch(`teeth.${index}.tooth`);
  const anterior = Number(tooth[1]) <= 3;
  return {
    conditions,
    tooth,
    anterior,
    addFinding: () =>
      conditions.append({ finding: 'other', surfaces: [], note: '' }),
  };
}
const positions = (primary: boolean) =>
  [...(primary ? [5, 6, 7, 8] : [1, 2, 3, 4])].flatMap((q) =>
    Array.from({ length: primary ? 5 : 8 }, (_, i) => `${q}${i + 1}`),
  );
export function useChartForm({
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
  const form = useForm<ChartValues>({
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
  const submit = form.handleSubmit(async (v) => {
    const { observedAt, ...content } = v;
    if (
      await state.save(
        'draft',
        content,
        new Date(observedAt + 'Z').toISOString(),
      )
    )
      form.reset(v);
  });
  function removeTooth() {
    form.setValue(
      'teeth',
      teeth.filter((tooth) => tooth.tooth !== selected),
      { shouldDirty: true },
    );
    setSelected('');
  }
  return {
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
  };
}
