import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Identity } from '@clinic/contracts';
import { HttpError } from '../identity/identity.api.js';
import { createIdentityWorkflow } from '../identity/identity.workflow.js';
import { schedulingApi } from './scheduling.api.js';
export function useSchedulingSettings(identity: Identity) {
  const [epoch, setEpoch] = useState(0);
  const client = useQueryClient();
  const key = ['scheduling', identity.clinicId, identity.accountId, 'settings'];
  const settings = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => schedulingApi.settings(signal),
    retry: false,
    gcTime: 0,
  });
  const [pending, setPending] = useState<{ path: string; body: object } | null>(
    null,
  );
  const mutation = useMutation({
    mutationFn: (c: { path: string; body: object }) =>
      schedulingApi.command(c.path, c.body),
    onSuccess: () => {
      setPending(null);
      void client
        .invalidateQueries({ queryKey: key })
        .then(() => setEpoch((v) => v + 1));
    },
    onError: async (e) => {
      await createIdentityWorkflow(client).reconcileDenied(e);
      if (e instanceof HttpError && e.status < 500) setPending(null);
    },
  });
  useEffect(
    () => () => {
      void client.cancelQueries({
        queryKey: ['scheduling', identity.clinicId, identity.accountId],
      });
      client.removeQueries({
        queryKey: ['scheduling', identity.clinicId, identity.accountId],
      });
    },
    [client, identity.clinicId, identity.accountId],
  );
  function submit(path: string, body: object) {
    if (pending || mutation.isPending) return;
    const command = { path, body: { ...body, commandId: crypto.randomUUID() } };
    setPending(command);
    mutation.mutate(command);
  }
  function retry() {
    if (pending && !mutation.isPending) mutation.mutate(pending);
  }
  async function reload() {
    if (pending || mutation.isPending) return;
    mutation.reset();
    const result = await settings.refetch();
    if (!result.isError) setEpoch((v) => v + 1);
  }
  return { epoch, settings, pending, mutation, submit, retry, reload };
}
