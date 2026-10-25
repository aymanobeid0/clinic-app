import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkflowLifetime } from "../../hooks/useWorkflowLifetime.js";
import { treatmentRead, treatmentDenied } from "./treatment.workflow.js";

// Explicit reload/print reads are scoped like commands; a late response must
// never populate a new patient, account, or closed preview.
export function useTreatmentRead<T>(key: readonly string[]) {
  const cache = useQueryClient();
  const scope = JSON.stringify(key);
  const owner = useMemo(() => {
    const controllers = new Set<AbortController>();
    return {
      controllers,
      async dispose() {
        for (const c of controllers) c.abort();
      },
    };
  }, [scope]);
  const current = useWorkflowLifetime(owner);
  const [state, setState] = useState<{
    owner: typeof owner;
    data?: T;
    error: string;
    busy: boolean;
    denied: boolean;
  }>({ owner, error: "", busy: false, denied: false });
  const visible =
    state.owner === owner
      ? state
      : { data: undefined, error: "", busy: false, denied: false };
  async function read(action: (signal: AbortSignal) => Promise<T>) {
    if (current.current !== owner || owner.controllers.size) return;
    const controller = new AbortController();
    owner.controllers.add(controller);
    setState({ owner, error: "", busy: true, denied: false });
    try {
      const data = await treatmentRead(
        cache,
        key,
        () => action(controller.signal),
        controller.signal,
      );
      if (current.current !== owner || controller.signal.aborted) return;
      setState({ owner, data, error: "", busy: false, denied: false });
      return data;
    } catch (error) {
      if (current.current === owner && !controller.signal.aborted)
        setState({
          owner,
          error:
            error instanceof Error ? error.message : "Relecture indisponible.",
          busy: false,
          denied: treatmentDenied(error),
        });
    } finally {
      owner.controllers.delete(controller);
    }
  }
  return {
    ...visible,
    read,
    clear: () => {
      for (const controller of owner.controllers) controller.abort();
      owner.controllers.clear();
      setState({ owner, error: "", busy: false, denied: false });
    },
  };
}
