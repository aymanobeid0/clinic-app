import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HttpError } from "../identity/identity.api.js";
import { useWorkflowLifetime } from "../../hooks/useWorkflowLifetime.js";
import {
  createTreatmentCommand,
  treatmentDenied,
} from "./treatment.workflow.js";
import { treatmentMessages as t } from "./treatment.messages.js";
export function useTreatmentCommand<T>(
  cacheKey: readonly string[],
  onSuccess?: (v: T) => void,
  onLock?: (kind: string, locked: boolean) => void,
  successMessage: string = t.saved,
  onError?: (error: unknown) => void,
) {
  const cache = useQueryClient();
  const scope = JSON.stringify(cacheKey);
  const workflow = useMemo(
    () => createTreatmentCommand<T>(cache, JSON.parse(scope) as string[]),
    [cache, scope],
  );
  const current = useWorkflowLifetime(workflow);
  const [feedback, setFeedback] = useState({
    owner: workflow,
    busy: false,
    uncertain: false,
    error: "",
    notice: "",
    denied: false,
    conflict: false,
  });
  const state =
    feedback.owner === workflow
      ? feedback
      : {
          busy: false,
          uncertain: false,
          error: "",
          notice: "",
          denied: false,
          conflict: false,
        };
  useEffect(() => {
    onLock?.("treatment", state.busy || state.uncertain);
    return () => onLock?.("treatment", false);
  }, [onLock, state.busy, state.uncertain]);
  async function run(action: () => Promise<T | undefined>) {
    if (workflow.busy || current.current !== workflow) return;
    setFeedback({
      owner: workflow,
      busy: true,
      uncertain: false,
      error: "",
      notice: "",
      denied: false,
      conflict: false,
    });
    try {
      const result = await action();
      if (current.current !== workflow || result === undefined) return;
      setFeedback({
        owner: workflow,
        busy: false,
        uncertain: false,
        error: "",
        notice: successMessage,
        denied: false,
        conflict: false,
      });
      onSuccess?.(result);
      await cache.invalidateQueries({ queryKey: cacheKey });
      return result;
    } catch (error) {
      if (current.current === workflow) onError?.(error);
      if (current.current === workflow)
        setFeedback({
          owner: workflow,
          busy: false,
          uncertain: workflow.uncertain,
          error:
            error instanceof Error ? error.message : "Service indisponible.",
          notice: "",
          denied: treatmentDenied(error),
          conflict: error instanceof HttpError && error.status === 409,
        });
    }
  }
  return {
    ...state,
    save: (path: string, data: object) =>
      workflow.uncertain
        ? Promise.resolve(undefined)
        : run(() => workflow.save(path, data)),
    retry: () =>
      workflow.uncertain ? run(workflow.retry) : Promise.resolve(undefined),
  };
}
export type TreatmentCommandState = {
  busy: boolean;
  uncertain: boolean;
  error: string;
  notice: string;
  retry: () => unknown;
};
export function CommandState({ state }: { state: TreatmentCommandState }) {
  return (
    <>
      {state.error && <p role="alert">{state.error}</p>}
      {state.uncertain && (
        <>
          <p role="alert">{t.uncertain}</p>
          <button
            type="button"
            disabled={state.busy}
            onClick={() => {
              void state.retry();
            }}
          >
            {t.retry}
          </button>
        </>
      )}
      {(state.busy || state.notice) && (
        <p role="status">{state.busy ? t.saving : state.notice}</p>
      )}
    </>
  );
}
