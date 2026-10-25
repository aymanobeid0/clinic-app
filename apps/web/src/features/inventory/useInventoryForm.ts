import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm, type DefaultValues } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type { Identity } from "@clinic/contracts";
import { identityScope } from "../identity/identity.workflow.js";
import { useTreatmentCommand } from "../treatment/useTreatmentCommand.js";
import { treatmentDenied } from "../treatment/treatment.workflow.js";
import {
  inventoryActions,
  inventoryAllowed,
  inventoryKey,
  type InventoryAction,
  type InventoryResults,
} from "./inventory.actions.js";
type Fields<K extends InventoryAction> = z.input<
  (typeof inventoryActions)[K]["schema"]
>;
// RHF owns transient input. Never persist drafts or retain command results in browser storage.
export function useInventoryForm<K extends InventoryAction>(
  action: K,
  identity: Identity,
  defaultValues: DefaultValues<Fields<K>>,
  targetId = "",
) {
  const cache = useQueryClient();
  const account = identityScope(identity);
  const root = inventoryKey(account);
  const scope = JSON.stringify([...root, action, targetId]);
  const form = useForm<Fields<K>>({ defaultValues });
  const initial = useRef(defaultValues);
  initial.current = defaultValues;
  const [validation, setValidation] = useState({ scope, error: "" });
  const readDenied = useSyncExternalStore(
    (notify) => cache.getQueryCache().subscribe(notify),
    () =>
      cache
        .getQueryCache()
        .findAll({ queryKey: root })
        .some((q) => treatmentDenied(q.state.error)),
  );
  const command = useTreatmentCommand<InventoryResults[K]>(
    [...root, action, targetId],
    () => {
      void cache.invalidateQueries({ queryKey: root });
    },
    undefined,
    "Mouvement ou réglage de stock enregistré.",
  );
  const denied =
    !inventoryAllowed(identity, inventoryActions[action].permission) ||
    command.denied ||
    readDenied;
  useEffect(() => {
    form.reset(initial.current);
  }, [scope, form]);
  useEffect(() => {
    if (denied) form.reset(initial.current);
    if (command.denied) {
      const key = inventoryKey(account);
      void cache.cancelQueries({ queryKey: key }).then(() => {
        for (const q of cache.getQueryCache().findAll({ queryKey: key }))
          q.setState({ data: undefined });
      });
    }
  }, [denied, command.denied, form, cache, account]);
  async function submit(confirmed: boolean) {
    if (!confirmed || denied || command.busy || command.uncertain) return;
    const parsed = inventoryActions[action].schema.safeParse(form.getValues());
    const update = action === "updateItem" || action === "updateSupplier";
    if (!parsed.success || (update && !z.uuid().safeParse(targetId).success)) {
      setValidation({
        scope,
        error: "Vérifiez les champs, les paquets entiers et le motif requis.",
      });
      return;
    }
    setValidation({ scope, error: "" });
    const path = `inventory/${inventoryActions[action].path}${update ? `/${encodeURIComponent(targetId)}` : ""}`;
    const result = await command.save(path, parsed.data);
    if (result === undefined)
      void cache.invalidateQueries({ queryKey: inventoryKey(account) });
    return result;
  }
  return {
    form,
    submit,
    busy: command.busy,
    uncertain: command.uncertain,
    denied,
    conflict: command.conflict,
    notice: command.notice,
    error:
      command.error || (validation.scope === scope ? validation.error : ""),
    retry: () => (denied ? Promise.resolve(undefined) : command.retry()),
  };
}
