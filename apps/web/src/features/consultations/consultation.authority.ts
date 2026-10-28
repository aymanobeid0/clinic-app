import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createStore, useStore } from "zustand";
import type { Identity } from "@clinic/contracts";
import { consultationKey } from "./consultation.access.js";

// Shared local suspension only: no server records, credentials or drafts. Keep
// each QueryClient/session independent and never persist this store.
const stores = new WeakMap<QueryClient, ReturnType<typeof createSuspensions>>();
function createSuspensions() {
  return createStore(() => ({ scopes: new Map<string, number>(), version: 0 }));
}
export function useConsultationAuthority(
  identity: Identity,
  patientId: string,
  accessScope: string,
) {
  const cache = useQueryClient();
  let store = stores.get(cache);
  if (!store) {
    store = createSuspensions();
    stores.set(cache, store);
  }
  const key = JSON.stringify(consultationKey(identity, patientId, accessScope));
  const generation = useStore(store, (state) => state.scopes.get(key));
  const retire = useCallback(async () => {
    store.setState((state) => ({
      scopes: new Map(state.scopes).set(key, state.version + 1),
      version: state.version + 1,
    }));
    const queryKey = JSON.parse(key) as string[];
    await cache.cancelQueries({ queryKey });
    for (const query of cache.getQueryCache().findAll({ queryKey }))
      query.setState({ data: undefined });
  }, [cache, key, store]);
  const resume = useCallback(
    (expected: number) => {
      store.setState((state) => {
        if (state.scopes.get(key) !== expected) return state;
        const scopes = new Map(state.scopes);
        scopes.delete(key);
        return { scopes };
      });
    },
    [key, store],
  );
  return { suspended: generation !== undefined, generation, retire, resume };
}
