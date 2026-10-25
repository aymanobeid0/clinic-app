import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import {
  verifiedCurrencies,
  type Catalog,
  type Identity,
  type TreatmentPlan,
} from "@clinic/contracts";
import { treatmentApi, formatMinor } from "./treatment.api.js";
import { useTreatmentRead } from "./useTreatmentRead.js";
import { useTreatmentCommand } from "./useTreatmentCommand.js";
import { treatmentMessages as t } from "./treatment.messages.js";
export type PlanItemFields = {
  id: string;
  procedureId: string;
  catalogRevision: number;
  scope: "tooth" | "teeth" | "whole_mouth";
  teeth: string;
  price: string;
  discount: string;
  discountReason: string;
  extras: { id: string; label: string; amount: string }[];
};
export type PlanFields = {
  title: string;
  notes: string;
  currency: keyof typeof verifiedCurrencies;
  items: PlanItemFields[];
};
export function usePlanForm({
  patientId,
  plan,
  catalog,
  identity,
  cacheKey,
  onLock,
  onDirty,
}: {
  patientId: string;
  plan?: TreatmentPlan;
  catalog: Catalog;
  identity: Identity;
  cacheKey: string[];
  onLock: (kind: string, v: boolean) => void;
  onDirty: (v: boolean) => void;
}) {
  const [snapshot, setSnapshot] = useState(plan);
  const [id] = useState(() => plan?.id ?? crypto.randomUUID());
  const [revision, setRevision] = useState(plan?.revision ?? 0);
  const [remote, setRemote] = useState<TreatmentPlan | undefined>();
  const [reconciled, setReconciled] = useState("");
  const reloadState = useTreatmentRead<TreatmentPlan[]>(cacheKey);
  const reloadError = reloadState.error;
  const f = useForm<PlanFields>({
    defaultValues: {
      title: plan?.title ?? "",
      notes: plan?.notes ?? "",
      currency: plan?.currency ?? catalog.currencies[0] ?? "MRU",
      items:
        plan?.items.map((i) => ({
          id: i.id,
          procedureId: i.procedureId,
          catalogRevision: i.catalogRevision,
          scope: i.scope,
          discountReason: i.discountReason,
          extras: (i.extras ?? []).map((e) => ({
            id: e.id,
            label: e.label,
            amount: formatMinor(
              e.amountMinor,
              verifiedCurrencies[plan.currency],
            ),
          })),
          teeth: i.teeth.join(" "),
          price: formatMinor(i.priceMinor, verifiedCurrencies[plan.currency]),
          discount: formatMinor(
            i.discountMinor,
            verifiedCurrencies[plan.currency],
          ),
        })) ?? [],
    },
  });
  const array = useFieldArray({
    control: f.control,
    name: "items",
    keyName: "fieldKey",
  });
  const dirty = f.formState.isDirty;
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  const currency = f.watch("currency");
  const command = useTreatmentCommand<TreatmentPlan>(
    cacheKey,
    (v) => {
      setSnapshot(v);
      setRevision(v.revision);
      f.reset(f.getValues());
      setReconciled("");
    },
    onLock,
  );
  const canOverride =
      identity.isManager || identity.permissions.includes("prices.override"),
    canDiscount =
      identity.isManager || identity.permissions.includes("discounts");
  function submit(v: PlanFields) {
    return command.save(`treatment/${patientId}/plans`, {
      ...v,
      id,
      revision,
      items: v.items.map((i) => ({
        ...i,
        teeth:
          i.scope === "whole_mouth"
            ? []
            : i.teeth
                .trim()
                .split(/[\s,;]+/)
                .filter(Boolean),
      })),
    });
  }
  // Drafts only: first save explicitly creates the identified proposal, later edits autosave.
  useEffect(() => {
    if (
      snapshot?.status !== "draft" ||
      !revision ||
      !f.formState.isDirty ||
      command.busy ||
      command.uncertain ||
      command.error
    )
      return;
    const timer = setTimeout(() => {
      void f.handleSubmit(submit)();
    }, 1200);
    return () => clearTimeout(timer);
  });
  const locked = command.busy || command.uncertain;

  async function reload() {
    const rows = await reloadState.read((signal) =>
      treatmentApi.plans(patientId, signal),
    );
    if (rows) {
      const current = rows.find((p) => p.id === id);
      setRevision(current?.revision ?? 0);
      setRemote(current);
      setReconciled(t.review);
    }
  }

  return {
    f,
    array,
    snapshot,
    id,
    revision,
    remote: command.denied || reloadState.denied ? undefined : remote,
    reconciled,
    reloadError,
    command,
    canOverride,
    canDiscount,
    currency,
    locked,
    submit,
    reload,
  };
}
