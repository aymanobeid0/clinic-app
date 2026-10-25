import { useId, useMemo, useState } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkflowLifetime } from "../../hooks/useWorkflowLifetime.js";
import { treatmentRead, treatmentDenied } from "./treatment.workflow.js";

// Server snapshots live in Query; React owns only request feedback. Each
// mounted reader has its own cache entry and abortable, StrictMode-safe lifetime.
export function useTreatmentRead<T>(key: readonly string[]) {
  const cache = useQueryClient();
  const readerId = useId();
  const scope = JSON.stringify([...key, "read", readerId]);
  const owner = useMemo(() => {
    const queryKey = JSON.parse(scope) as string[];
    const controllers = new Set<AbortController>();
    return {
      queryKey,
      controllers,
      async dispose() {
        for (const controller of controllers) controller.abort();
        await cache.cancelQueries({ queryKey, exact: true });
        cache.removeQueries({ queryKey, exact: true });
      },
    };
  }, [cache, scope]);
  const snapshot = useQuery<T>({
    queryKey: owner.queryKey,
    queryFn: skipToken,
    gcTime: 0,
    retry: false,
  });
  const current = useWorkflowLifetime(owner);
  const [state, setState] = useState({
    owner,
    error: "",
    busy: false,
    denied: false,
  });
  const visible =
    state.owner === owner ? state : { error: "", busy: false, denied: false };
  function clearSnapshot() {
    for (const query of cache
      .getQueryCache()
      .findAll({ queryKey: owner.queryKey, exact: true }))
      query.setState({ data: undefined });
  }
  async function read(action: (signal: AbortSignal) => Promise<T>) {
    if (current.current !== owner || owner.controllers.size) return;
    const controller = new AbortController();
    owner.controllers.add(controller);
    clearSnapshot();
    setState({ owner, error: "", busy: true, denied: false });
    try {
      const data = await cache.fetchQuery<T>({
        queryKey: owner.queryKey,
        gcTime: 0,
        retry: false,
        staleTime: 0,
        queryFn: ({ signal: querySignal }) => {
          const signal = AbortSignal.any([querySignal, controller.signal]);
          return treatmentRead(cache, key, () => action(signal), signal);
        },
      });
      if (current.current !== owner || controller.signal.aborted) return;
      setState({ owner, error: "", busy: false, denied: false });
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
    data: visible.denied ? undefined : snapshot.data,
    read,
    clear: () => {
      for (const controller of owner.controllers) controller.abort();
      owner.controllers.clear();
      void cache.cancelQueries({ queryKey: owner.queryKey, exact: true });
      clearSnapshot();
      setState({ owner, error: "", busy: false, denied: false });
    },
  };
}
