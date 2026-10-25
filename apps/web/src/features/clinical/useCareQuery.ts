import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { treatmentGet } from "../treatment/treatment.api.js";
import {
  treatmentRead,
  treatmentDenied,
} from "../treatment/treatment.workflow.js";

// Patient/account keys are supplied by the feature owner; never persist these records.
export function useCareQuery<T>(
  key: readonly string[],
  path: string,
  events?: string,
  enabled = true,
) {
  const cache = useQueryClient();
  const scope = JSON.stringify(key);
  const query = useQuery({
    queryKey: key,
    gcTime: 0,
    retry: false,
    enabled,
    queryFn: ({ signal }) =>
      treatmentRead(cache, key, () => treatmentGet<T>(path, signal), signal),
  });
  useEffect(() => {
    const queryKey = JSON.parse(scope) as string[];
    const stream =
      events && enabled ? new EventSource(`/api/${events}`) : undefined;
    const refresh = () => {
      void cache.invalidateQueries({ queryKey });
    };
    stream?.addEventListener("invalidate", refresh);
    if (stream) {
      stream.onopen = refresh;
      stream.onerror = refresh;
    }
    return () => {
      stream?.close();
      // Equal-key readers share a Query. Retiring one must not orphan others.
      const query = cache.getQueryCache().find({ queryKey, exact: true });
      if (!query?.getObserversCount()) {
        void cache.cancelQueries({ queryKey, exact: true });
        cache.removeQueries({ queryKey, exact: true });
      }
    };
  }, [cache, scope, events, enabled]);
  return {
    ...query,
    data: treatmentDenied(query.error) ? undefined : query.data,
    denied: treatmentDenied(query.error),
  };
}
