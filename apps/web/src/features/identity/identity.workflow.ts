import type { QueryClient } from "@tanstack/react-query";
import type { Identity, SignIn } from "@clinic/contracts";
import { identityApi, refreshSession } from "./identity.api.js";

// Deliberately use commands rather than cached mutations: passwords and recovery
// material must never become TanStack mutation variables/results.
export function identityScope(identity: Identity | null | undefined) {
  return identity
    ? JSON.stringify([
        identity.clinicId,
        identity.accountId,
        identity.stage,
        identity.historicalOnly,
        identity.isManager,
        identity.kind,
        [...identity.permissions].sort(),
        identity.recoverySetup,
      ])
    : "";
}

export function createIdentityWorkflow(cache: QueryClient) {
  let observed = "";
  async function clearSensitiveQueries() {
    const others = {
      predicate: (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[0] !== "identity",
    };
    await cache.cancelQueries(others);
    cache.removeQueries(others);
    cache.getMutationCache().clear();
  }
  async function transition(action: () => Promise<unknown>) {
    await cache.cancelQueries();
    await clearSensitiveQueries();
    cache.setQueryData(["identity"], null);
    try {
      await action();
    } finally {
      await cache.invalidateQueries({ queryKey: ["identity"] });
    }
  }
  return {
    query: {
      queryKey: ["identity"] as const,
      retry: false,
      async queryFn({ signal }: { signal?: AbortSignal } = {}) {
        try {
          const identity = await identityApi.getIdentity(signal);
          if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
          const next = identityScope(identity);
          if (next !== observed) await clearSensitiveQueries();
          observed = next;
          return identity;
        } catch (error) {
          if (!signal?.aborted) {
            observed = "";
            await clearSensitiveQueries();
          }
          throw error;
        }
      },
    },
    async signIn(input: SignIn) {
      await transition(async () => {
        await refreshSession();
        await identityApi.signIn(input);
      });
    },
    transition,
    clearSensitiveQueries,
  };
}
