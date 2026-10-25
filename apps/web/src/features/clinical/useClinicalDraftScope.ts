import { useMemo } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkflowLifetime } from "../../hooks/useWorkflowLifetime.js";

// Shared only by the two clinical draft editors. Server comparison snapshots
// belong to Query; the lifetime prevents old writes from updating a new scope.
export function useClinicalDraftScope<T>(key: readonly string[]) {
  const cache = useQueryClient();
  const scope = JSON.stringify(key);
  const owner = useMemo(() => {
    const queryKey = [...(JSON.parse(scope) as string[]), "comparison"];
    const controller = new AbortController();
    return {
      queryKey,
      controller,
      async dispose() {
        controller.abort();
        cache.removeQueries({ queryKey, exact: true });
      },
    };
  }, [cache, scope]);
  const current = useWorkflowLifetime(owner);
  const query = useQuery<T>({
    queryKey: owner.queryKey,
    queryFn: skipToken,
    gcTime: 0,
    retry: false,
  });
  const active = () =>
    current.current === owner && !owner.controller.signal.aborted;
  function setCompared(value: T | null) {
    if (!active()) return;
    if (value !== null) cache.setQueryData(owner.queryKey, value);
    else
      for (const q of cache
        .getQueryCache()
        .findAll({ queryKey: owner.queryKey, exact: true }))
        q.setState({ data: undefined });
  }
  return { owner, active, compared: query.data ?? null, setCompared };
}
