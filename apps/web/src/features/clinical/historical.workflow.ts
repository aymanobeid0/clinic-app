import type { QueryClient } from '@tanstack/react-query';
import type { HistoricalSnapshot } from '@clinic/contracts';
import { HttpError } from '../identity/identity.api.js';
import { createIdentityWorkflow } from '../identity/identity.workflow.js';
import { historicalApi } from './historical.api.js';
export function createHistoricalWorkflow(
  cache: QueryClient,
  accountKey: string,
) {
  const prefix = ['historical', accountKey];
  let disposed = false;
  async function read<T>(action: () => Promise<T>) {
    if (disposed) throw new Error('Dossier fermé.');
    try {
      const result = await action();
      if (disposed) throw new Error('Dossier fermé.');
      return result;
    } catch (error) {
      if (
        error instanceof HttpError &&
        [401, 403, 404].includes(error.status)
      ) {
        // Keep the active query alive so its rejection reaches mounted observers.
        for (const query of cache
          .getQueryCache()
          .findAll({ queryKey: prefix })) {
          query.setState({ data: undefined });
        }
        await createIdentityWorkflow(cache).reconcileDenied(error);
      }
      throw error;
    }
  }
  async function change(action: () => Promise<unknown>) {
    await read(action);
    await Promise.all([
      cache.invalidateQueries({ queryKey: prefix }),
      cache.invalidateQueries({ queryKey: ['patient-access', accountKey] }),
      cache.invalidateQueries({ queryKey: ['clinical-patients', accountKey] }),
    ]);
  }
  return {
    grant: (
      patientId: string,
      input: Parameters<typeof historicalApi.grant>[1],
    ) => change(() => historicalApi.grant(patientId, input)),
    revoke: (
      patientId: string,
      input: Parameters<typeof historicalApi.revoke>[1],
    ) => change(() => historicalApi.revoke(patientId, input)),
    patientsQuery: {
      queryKey: [...prefix, 'patients'],
      queryFn: ({ signal }: { signal?: AbortSignal } = {}) =>
        read(() => historicalApi.patients(signal)),
      retry: false as const,
      gcTime: 0,
    },
    snapshotQuery(id: string) {
      return {
        queryKey: [...prefix, id],
        queryFn: ({ signal }: { signal?: AbortSignal } = {}) =>
          read(() => historicalApi.snapshot(id, signal)),
        retry: false as const,
        gcTime: 0,
      };
    },
    // Only select versions already returned in the authorized server snapshot.
    version(snapshot: HistoricalSnapshot, kind: string, revision: number) {
      return snapshot.clinical
        .find((record) => record.kind === kind)
        ?.versions.find((version) => version.revision === revision);
    },
    attachment: (
      patientId: string,
      id: string,
      revision: number,
      signal?: AbortSignal,
    ) => read(() => historicalApi.attachment(patientId, id, revision, signal)),
    async dispose() {
      disposed = true;
      await cache.cancelQueries({ queryKey: prefix });
      cache.removeQueries({ queryKey: prefix });
    },
  };
}
