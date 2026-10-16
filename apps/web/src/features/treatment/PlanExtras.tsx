import { useState } from 'react';
import { useFieldArray, type Control } from 'react-hook-form';
import type { PlanFields } from './PlanForm.js';
export function PlanExtras({
  control,
  index,
  canOverride,
}: {
  control: Control<PlanFields>;
  index: number;
  canOverride: boolean;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `items.${index}.extras`,
    keyName: 'fieldKey',
  });
  const [label, setLabel] = useState(''),
    [amount, setAmount] = useState('');
  return (
    <div>
      <ul>
        {fields.map((e, n) => (
          <li key={e.fieldKey}>
            {e.label} · {e.amount}
            <button
              type="button"
              disabled={!canOverride}
              onClick={() => remove(n)}
            >
              Retirer les frais {n + 1} · acte {index + 1}
            </button>
          </li>
        ))}
      </ul>
      {canOverride && (
        <>
          <label>
            Libellé des frais supplémentaires · acte {index + 1}
            <input
              maxLength={200}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label>
            Montant des frais supplémentaires · acte {index + 1}
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!label.trim() || !amount.trim()}
            onClick={() => {
              append({ id: crypto.randomUUID(), label, amount });
              setLabel('');
              setAmount('');
            }}
          >
            Ajouter les frais · acte {index + 1}
          </button>
        </>
      )}
    </div>
  );
}
