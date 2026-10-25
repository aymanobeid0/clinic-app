import type { QueryClient } from "@tanstack/react-query";
import { HttpError, post } from "../identity/identity.api.js";
import { createIdentityWorkflow } from "../identity/identity.workflow.js";

export function treatmentDenied(error: unknown) {
  return error instanceof HttpError && [401, 403, 404].includes(error.status);
}
export async function treatmentRead<T>(
  cache: QueryClient,
  key: readonly string[],
  read: () => Promise<T>,
  signal?: AbortSignal,
) {
  try {
    const value = await read();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return value;
  } catch (error) {
    if (!signal?.aborted && treatmentDenied(error)) {
      for (const query of cache.getQueryCache().findAll({ queryKey: key }))
        query.setState({ data: undefined });
      await createIdentityWorkflow(cache).reconcileDenied(error);
    }
    throw error;
  }
}

export function createTreatmentCommand<T>(
  cache: QueryClient,
  key: readonly string[],
) {
  let pending: { path: string; data: object } | undefined;
  let busy = false;
  let disposed = false;
  async function execute() {
    if (disposed || busy || !pending) return;
    busy = true;
    const request = pending;
    try {
      const result = await post<T>(request.path, request.data);
      if (disposed) return;
      pending = undefined;
      return result;
    } catch (error) {
      if (disposed) return;
      if (error instanceof HttpError && error.status < 500) pending = undefined;
      if (treatmentDenied(error)) {
        for (const query of cache.getQueryCache().findAll({ queryKey: key }))
          query.setState({ data: undefined });
        await createIdentityWorkflow(cache).reconcileDenied(error);
        await cache.invalidateQueries({ queryKey: key });
      }
      throw error;
    } finally {
      busy = false;
    }
  }
  return {
    get busy() {
      return busy;
    },
    get uncertain() {
      return !!pending && !busy;
    },
    save(path: string, data: object) {
      if (busy || disposed || pending) return Promise.resolve(undefined);
      // Preserve the exact sent payload and command ID after a lost response.
      pending ??= {
        path,
        data: structuredClone({ ...data, commandId: crypto.randomUUID() }),
      };
      return execute();
    },
    retry: execute,
    async dispose() {
      disposed = true;
      pending = undefined;
    },
  };
}
