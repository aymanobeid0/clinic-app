import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Identity, TreatmentPlan } from "@clinic/contracts";
import { treatmentApi, treatmentGet } from "./treatment.api.js";
import { treatmentRead, treatmentDenied } from "./treatment.workflow.js";

export function useCatalog(identity: Identity, live = false) {
  const cache = useQueryClient();
  const { clinicId, accountId } = identity;
  const key = ["catalog", clinicId, accountId];
  const query = useQuery({
    queryKey: key,
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      treatmentRead(cache, key, () => treatmentApi.catalog(signal), signal),
  });
  useEffect(() => {
    if (!live) return;
    const stream = new EventSource("/api/catalog/events");
    const refresh = () => {
      void cache.invalidateQueries({
        queryKey: ["catalog", clinicId, accountId],
      });
      void cache.invalidateQueries({
        queryKey: ["currencies", clinicId, accountId],
      });
      void cache.invalidateQueries({
        predicate: ({ queryKey }) =>
          queryKey[0] === "scheduling" && queryKey[3] === "suggestions",
      });
    };
    stream.addEventListener("invalidate", refresh);
    stream.onopen = refresh;
    stream.onerror = refresh;
    return () => {
      stream.close();
    };
  }, [cache, clinicId, accountId, live]);
  return {
    ...query,
    data: treatmentDenied(query.error) ? undefined : query.data,
  };
}

export function useCurrencies(identity: Identity) {
  const cache = useQueryClient();
  const { clinicId, accountId } = identity;
  const key = ["currencies", clinicId, accountId];
  const query = useQuery({
    queryKey: key,
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      treatmentRead(
        cache,
        key,
        () => treatmentGet<{ code: string }[]>("catalog/currencies", signal),
        signal,
      ),
  });
  useEffect(() => {
    const stream = new EventSource("/api/catalog/currencies/events");
    const refresh = () => {
      void cache.invalidateQueries({
        queryKey: ["currencies", clinicId, accountId],
      });
      void cache.invalidateQueries({
        queryKey: ["catalog", clinicId, accountId],
      });
    };
    stream.addEventListener("invalidate", refresh);
    stream.onopen = refresh;
    stream.onerror = () => {
      refresh();
    };
    return () => {
      stream.close();
    };
  }, [cache, clinicId, accountId]);
  return {
    ...query,
    data: treatmentDenied(query.error) ? undefined : query.data,
  };
}

export function useTreatmentPlans(id: string, identity: Identity) {
  const cache = useQueryClient();
  const { clinicId, accountId } = identity;
  const key = ["plans", clinicId, accountId, id];
  const [connected, setConnected] = useState(true);
  const query = useQuery({
    queryKey: key,
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      treatmentRead(cache, key, () => treatmentApi.plans(id, signal), signal),
  });
  useEffect(() => {
    const stream = new EventSource(`/api/treatment/${id}/events`);
    const refresh = () => {
      setConnected(true);
      void cache.invalidateQueries({
        queryKey: ["visits", clinicId, accountId, id],
      });
      void cache.invalidateQueries({
        queryKey: ["plans", clinicId, accountId, id],
      });
      void cache.invalidateQueries({
        queryKey: ["catalog", clinicId, accountId],
      });
    };
    stream.addEventListener("invalidate", refresh);
    stream.onopen = () => setConnected(true);
    stream.onerror = () => {
      setConnected(false);
      void cache.invalidateQueries({
        queryKey: ["plans", clinicId, accountId, id],
      });
    };
    return () => {
      stream.close();
      void cache.cancelQueries({
        queryKey: ["plans", clinicId, accountId, id],
      });
      cache.removeQueries({ queryKey: ["plans", clinicId, accountId, id] });
    };
  }, [cache, clinicId, accountId, id]);
  return {
    key,
    connected,
    updatePlan: (value: TreatmentPlan) =>
      cache.setQueryData<TreatmentPlan[]>(key, (rows) =>
        rows?.map((plan) => (plan.id === value.id ? value : plan)),
      ),
    query: {
      ...query,
      data: treatmentDenied(query.error) ? undefined : query.data,
    },
  };
}
