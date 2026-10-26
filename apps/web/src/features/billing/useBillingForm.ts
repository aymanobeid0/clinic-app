import { localFieldErrors, serverFieldErrors } from "../../forms/fieldErrors.js";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm, type DefaultValues } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { useTreatmentCommand } from "../treatment/useTreatmentCommand.js";
import { treatmentDenied } from "../treatment/treatment.workflow.js";
import { billingMessages as t } from "./billing.messages.js";
import {
  billingActions,
  billingKey,
  type BillingAction,
  type BillingResults,
} from "./billing.actions.js";

type Fields<K extends BillingAction> = z.input<
  (typeof billingActions)[K]["schema"]
>;
// accountKey includes clinic/account/permission scope (identityScope). No persistent drafts.
export function useBillingForm<K extends BillingAction>(
  action: K,
  accountKey: string,
  patientId: string,
  defaultValues: DefaultValues<Fields<K>>,
) {
  const cache = useQueryClient();
  const key = billingKey(
    accountKey,
    action === "method" ? "methods" : patientId,
  );
  const scope = JSON.stringify([...key, action]);
  const form = useForm<Fields<K>>({ defaultValues });
  const initial = useRef(defaultValues);
  initial.current = defaultValues;
  const [validation, setValidation] = useState({ scope, error: "" });
  const readDenied = useSyncExternalStore(
    (notify) => cache.getQueryCache().subscribe(notify),
    () =>
      cache
        .getQueryCache()
        .findAll({ queryKey: key })
        .some((q) => treatmentDenied(q.state.error)),
  );
  const command = useTreatmentCommand<BillingResults[K]>(
    [...key, action],
    () => {
      // RHF retains input only in this tab. Results are re-read through authorized queries.
      void cache.invalidateQueries({ queryKey: ["billing", accountKey] });
    },
    undefined,
    t.saved,
    (error) => serverFieldErrors(form, error),
  );
  useEffect(() => {
    form.reset(initial.current);
  }, [scope, form]);
  useEffect(() => {
    if (command.denied || readDenied) form.reset(initial.current);
    if (command.denied) {
      void cache.cancelQueries({ queryKey: key }).then(() => {
        for (const query of cache.getQueryCache().findAll({ queryKey: key }))
          query.setState({ data: undefined });
      });
    }
  }, [command.denied, readDenied, form, cache, scope]);
  async function submit(confirmed: boolean) {
    if (
      !confirmed ||
      command.busy ||
      command.uncertain ||
      command.denied ||
      readDenied
    )
      return;
    form.clearErrors();
    const parsed = billingActions[action].schema.safeParse(form.getValues());
    if (!parsed.success) {
      setValidation({
        scope,
        error: !parsed.success ? localFieldErrors(form, parsed.error) : t.invalid,
      });
      return;
    }
    setValidation({ scope, error: "" });
    const path =
      action === "method"
        ? "billing/payment-methods"
        : `billing/${encodeURIComponent(patientId)}/${billingActions[action].path}`;
    return command.save(path, parsed.data);
  }
  return {
    busy: command.busy,
    uncertain: command.uncertain,
    denied: command.denied || readDenied,
    conflict: command.conflict,
    notice: command.notice,
    form,
    submit,
    error:
      command.error || (validation.scope === scope ? validation.error : ""),
    // Retry ignores newer form values and replays the exact retained command.
    retry: () => (readDenied ? Promise.resolve(undefined) : command.retry()),
  };
}
