import { PlanExtras } from "./PlanExtras.js";
import { usePlanItems } from "./usePlanItems.js";
import type {
  UseFormRegister,
  FieldArrayWithId,
  Control,
} from "react-hook-form";
import {
  verifiedCurrencies,
  type Catalog,
  type TreatmentPlan,
} from "@clinic/contracts";
import { formatMinor } from "./treatment.api.js";
import { treatmentMessages as t } from "./treatment.messages.js";
import type { PlanFields, PlanItemFields } from "./usePlanForm.js";
export function PlanItems({
  catalog,
  currency,
  snapshot,
  register,
  fields,
  append,
  remove,
  canOverride,
  canDiscount,
  control,
}: {
  catalog: Catalog;
  currency: keyof typeof verifiedCurrencies;
  snapshot?: TreatmentPlan;
  register: UseFormRegister<PlanFields>;
  fields: FieldArrayWithId<PlanFields, "items", "fieldKey">[];
  append: (item: PlanItemFields) => void;
  remove: (index: number) => void;
  canOverride: boolean;
  canDiscount: boolean;
  control: Control<PlanFields>;
}) {
  const { procedure, setProcedure, available, add } = usePlanItems(
    catalog,
    currency,
    append,
  );
  return (
    <>
      {" "}
      <label>
        {t.choose}
        <select
          aria-label={t.choose}
          value={procedure}
          onChange={(e) => setProcedure(e.target.value)}
        >
          <option value="">{t.choose}</option>
          {available.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ·{" "}
              {formatMinor(e.priceMinor, verifiedCurrencies[e.currency])}{" "}
              {e.currency}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!procedure}
        onClick={() => {
          add();
        }}
      >
        {t.add}
      </button>
      {fields.map((field, index) => (
        <fieldset key={field.fieldKey} className="treatment-item">
          <legend>
            Acte {index + 1} ·{" "}
            {snapshot?.items.find((i) => i.id === field.id)?.name ??
              catalog.entries.find((e) => e.id === field.procedureId)?.name}
          </legend>
          <label>
            {t.scope}
            <select aria-label={t.scope} {...register(`items.${index}.scope`)}>
              <option value="whole_mouth">{t.whole}</option>
              <option value="tooth">{t.tooth}</option>
              <option value="teeth">{t.multiple}</option>
            </select>
          </label>
          <label>
            {t.teeth}
            <input {...register(`items.${index}.teeth`)} />
          </label>
          <label>
            {t.price} · {currency}
            <input
              required
              inputMode="decimal"
              readOnly={!canOverride}
              {...register(`items.${index}.price`)}
            />
          </label>
          <label>
            {t.discount} · {currency}
            <input
              required
              inputMode="decimal"
              readOnly={!canDiscount}
              {...register(`items.${index}.discount`)}
            />
          </label>
          <label>
            {t.reason}
            <input
              maxLength={1000}
              readOnly={!canDiscount}
              {...register(`items.${index}.discountReason`)}
            />
          </label>
          <PlanExtras
            control={control}
            index={index}
            canOverride={canOverride}
          />
          <button type="button" onClick={() => remove(index)}>
            {t.remove} {index + 1}
          </button>
        </fieldset>
      ))}
    </>
  );
}
