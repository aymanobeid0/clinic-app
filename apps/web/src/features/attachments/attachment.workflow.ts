import type { QueryClient } from '@tanstack/react-query';
import type {
  AttachmentClass,
  AttachmentUsage,
  AttachmentVersion,
  AttachmentRecord,
} from '@clinic/contracts';
import { HttpError } from '../identity/identity.api.js';
import { createIdentityWorkflow } from '../identity/identity.workflow.js';
import { attachmentApi } from './attachment.api.js';

export type AttachmentUpload = {
  file: Blob;
  name: string;
  classification: AttachmentClass;
  attachmentId?: string;
  revision?: number;
  reason?: string;
};
export function createAttachmentWorkflow(
  cache: QueryClient,
  accountKey: string,
  patientId: string,
) {
  const prefix = ['attachments', accountKey, patientId];
  let pending:
    (() => Promise<AttachmentVersion | AttachmentRecord>) | undefined;
  let running = false;
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
        for (const query of cache.getQueryCache().findAll({ queryKey: prefix }))
          query.setState({ data: undefined });
        await createIdentityWorkflow(cache).reconcileDenied(error);
      }
      throw error;
    }
  }
  async function execute() {
    if (disposed) throw new Error('Dossier fermé.');
    if (running) throw new Error('Enregistrement en cours.');
    if (!pending) throw new Error('Aucune demande à réessayer.');
    running = true;
    try {
      const result = await pending();
      if (disposed) throw new Error('Dossier fermé.');
      pending = undefined;
      await cache.invalidateQueries({ queryKey: prefix });
      return result;
    } catch (error) {
      if (error instanceof HttpError && error.status < 500) pending = undefined;
      // Local validation has not sent an uncertain command.
      if (error instanceof Error && error.name === 'ZodError')
        pending = undefined;
      await createIdentityWorkflow(cache).reconcileDenied(error);
      throw error;
    } finally {
      running = false;
    }
  }
  function requireNewCommand() {
    if (disposed) throw new Error('Dossier fermé.');
    if (pending)
      throw new Error(
        'Réessayez la demande conservée avant de modifier la saisie.',
      );
  }
  return {
    get uncertain() {
      return !!pending && !running;
    },
    get busy() {
      return running;
    },
    listQuery(classification: AttachmentClass) {
      return {
        queryKey: [...prefix, 'list', classification],
        queryFn: ({ signal }: { signal?: AbortSignal } = {}) =>
          read(() => attachmentApi.list(patientId, classification, signal)),
        gcTime: 0,
        retry: false as const,
      };
    },
    historyQuery(id: string, classification: AttachmentClass) {
      return {
        queryKey: [...prefix, 'history', id, classification],
        queryFn: ({ signal }: { signal?: AbortSignal } = {}) =>
          read(() =>
            attachmentApi.history(patientId, id, classification, signal),
          ),
        gcTime: 0,
        retry: false as const,
      };
    },
    async upload(input: AttachmentUpload, usage?: AttachmentUsage) {
      requireNewCommand();
      if (usage && input.file.size > usage.fileLimitBytes)
        throw new Error('Le fichier dépasse la taille autorisée.');
      if (
        usage &&
        input.file.size + usage.retainedBytes + usage.reservedBytes >
          usage.limitBytes
      )
        throw new Error(
          'Quota de stockage atteint. Les fichiers existants restent accessibles.',
        );
      const { file, attachmentId, ...details } = input;
      const command = { ...details, commandId: crypto.randomUUID() };
      pending = () =>
        attachmentApi.upload(patientId, file, command, attachmentId);
      return execute();
    },
    async remove(
      id: string,
      classification: AttachmentClass,
      revision: number,
      reason: string,
      confirmed: boolean,
    ) {
      requireNewCommand();
      if (!confirmed) return Promise.resolve(undefined);
      const command = { revision, reason, commandId: crypto.randomUUID() };
      pending = () =>
        attachmentApi.remove(patientId, id, classification, command);
      return execute();
    },
    retry: execute,
    content: (
      id: string,
      revision: number,
      classification: AttachmentClass,
      signal?: AbortSignal,
    ) =>
      read(() =>
        attachmentApi.content(patientId, id, revision, classification, signal),
      ),
    async dispose() {
      disposed = true;
      pending = undefined;
      await cache.cancelQueries({ queryKey: prefix });
      cache.removeQueries({ queryKey: prefix });
    },
  };
}
