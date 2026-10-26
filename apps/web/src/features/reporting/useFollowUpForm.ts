import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm, type DefaultValues } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  createFollowUpSchema,
  updateFollowUpSchema,
  type Identity,
  type FollowUp,
} from "@clinic/contracts";
import { identityScope } from "../identity/identity.workflow.js";
import { useTreatmentCommand } from "../treatment/useTreatmentCommand.js";
import { treatmentDenied } from "../treatment/treatment.workflow.js";
import { reportAllowed, reportingKey } from "./reporting.access.js";
const schemas = {
  create: createFollowUpSchema.omit({ commandId: true }),
  update: updateFollowUpSchema.omit({ commandId: true }),
};
type Fields<K extends keyof typeof schemas> = z.input<(typeof schemas)[K]>;
export function useFollowUpForm<K extends keyof typeof schemas>(
  action: K,
  identity: Identity,
  defaults: DefaultValues<Fields<K>>,
  taskId = "",
) {
  const cache = useQueryClient();
  const account = identityScope(identity);
  const root = reportingKey(account);
  const selectedPatient = "patientId" in defaults ? defaults.patientId : "";
  const scope = JSON.stringify([...root, action, taskId, selectedPatient]);
  const form = useForm<Fields<K>>({ defaultValues: defaults });
  const initial = useRef(defaults);
  initial.current = defaults;
  const [validation, setValidation] = useState({ scope, error: "" });
  const readDenied = useSyncExternalStore(
    (notify) => cache.getQueryCache().subscribe(notify),
    () =>
      cache
        .getQueryCache()
        .findAll({ queryKey: root })
        .some((q) => treatmentDenied(q.state.error)),
  );
  const command = useTreatmentCommand<FollowUp>(
    [...root, action, taskId],
    () => {
      void cache.invalidateQueries({ queryKey: root });
    },
    undefined,
    "Suivi enregistré.",
  );
  const denied =
    !reportAllowed(identity, "tasks") || command.denied || readDenied;
  useEffect(() => {
    form.reset(initial.current);
  }, [scope, form]);
  useEffect(() => {
    if (denied) form.reset(initial.current);
    if (command.denied) {
      const key = reportingKey(account);
      void cache.cancelQueries({ queryKey: key }).then(() => {
        for (const q of cache.getQueryCache().findAll({ queryKey: key }))
          q.setState({ data: undefined });
      });
    }
  }, [denied, command.denied, form, cache, account]);
  async function submit(confirmed: boolean) {
    if (!confirmed || denied || command.busy || command.uncertain) return;
    const parsed = schemas[action].safeParse(form.getValues());
    if (
      !parsed.success ||
      (action === "update" && !z.uuid().safeParse(taskId).success)
    ) {
      setValidation({
        scope,
        error: "Vérifiez le patient, la date et la révision du suivi.",
      });
      return;
    }
    setValidation({ scope, error: "" });
    const result = await command.save(
      `follow-ups${action === "update" ? `/${encodeURIComponent(taskId)}` : ""}`,
      parsed.data,
    );
    // Includes uncertain outcomes and conflicts: current state/history must be reconciled.
    if (result === undefined)
      void cache.invalidateQueries({ queryKey: reportingKey(account) });
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
    retry: async () => {
      if (denied) return;
      const result = await command.retry();
      if (result === undefined)
        void cache.invalidateQueries({ queryKey: reportingKey(account) });
      return result;
    },
  };
}
