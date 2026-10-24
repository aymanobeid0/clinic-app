import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { HttpError } from '../identity/identity.api.js';
import { createIdentityWorkflow } from '../identity/identity.workflow.js';
import { accessApi } from './access.api.js';
import { accessText as t } from './access.messages.js';
export function useAssignmentEditor({
  id,
  accountKey,
  onLock,
}: {
  id: string;
  accountKey: string;
  onLock: (locked: boolean) => void;
}) {
  const cache = useQueryClient();
  const prefix = ['patient-access', accountKey];
  const record = useQuery({
    queryKey: [...prefix, id],
    queryFn: ({ signal }) => accessApi.get(id, signal),
    gcTime: 0,
  });
  const history = useQuery({
    queryKey: [...prefix, id, 'history'],
    queryFn: ({ signal }) => accessApi.history(id, signal),
    gcTime: 0,
  });
  const form = useForm<{ accountId: string; kind: 'assigned' | 'shared' }>({
    defaultValues: { accountId: '', kind: 'shared' },
  });
  const pending = useRef<{
    action: 'share' | 'remove';
    data: {
      accountId: string;
      kind?: 'assigned' | 'shared';
      revision: number;
      commandId: string;
    };
  } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const change = async (
    action: 'share' | 'remove',
    accountId: string,
    kind?: 'assigned' | 'shared',
  ) => {
    if ((!record.data || record.error) && !pending.current) return;
    pending.current ??= {
      action,
      data: {
        accountId,
        kind,
        revision: record.data!.revision,
        commandId: crypto.randomUUID(),
      },
    };
    setBusy(true);
    onLock(true);
    setMessage('');
    try {
      const cmd = pending.current;
      if (cmd.action === 'share')
        await accessApi.share(id, { ...cmd.data, kind: cmd.data.kind! });
      else
        await accessApi.remove(id, {
          accountId: cmd.data.accountId,
          revision: cmd.data.revision,
          commandId: cmd.data.commandId,
        });
      pending.current = null;
      setUncertain(false);
      onLock(false);
      setMessage(action === 'share' ? t.saved : t.removed);
      await cache.invalidateQueries({ queryKey: prefix });
    } catch (e) {
      await createIdentityWorkflow(cache).reconcileDenied(e);
      if (e instanceof HttpError && e.status < 500) {
        pending.current = null;
        setUncertain(false);
        onLock(false);
      } else {
        setUncertain(true);
        onLock(true);
      }
      setMessage(e instanceof Error ? e.message : t.unavailable);
    } finally {
      setBusy(false);
    }
  };
  const submit = form.handleSubmit((values) =>
    change('share', values.accountId, values.kind),
  );
  function retry() {
    const command = pending.current;
    if (command && !busy)
      void change(command.action, command.data.accountId, command.data.kind);
  }
  function reload() {
    if (!busy && !uncertain) void cache.invalidateQueries({ queryKey: prefix });
  }
  return {
    submit,
    retry,
    reload,
    record,
    history,
    form,
    uncertain,
    busy,
    message,
    change,
  };
}
