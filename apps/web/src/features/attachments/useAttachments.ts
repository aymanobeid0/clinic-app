import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AttachmentClass, AttachmentUsage } from '@clinic/contracts';
import {
  createAttachmentWorkflow,
  type AttachmentUpload,
} from './attachment.workflow.js';
export function useAttachments(
  accountKey: string,
  patientId: string,
  classification: AttachmentClass,
) {
  const cache = useQueryClient();
  const workflow = useMemo(
    () => createAttachmentWorkflow(cache, accountKey, patientId),
    [cache, accountKey, patientId],
  );
  const list = useQuery({
    ...workflow.listQuery(classification),
    enabled: !!patientId,
  });
  const current = useRef(workflow);
  current.current = workflow;
  const [feedback, setFeedback] = useState({
    owner: workflow,
    busy: false,
    error: '',
    uncertain: false,
  });
  const visible =
    feedback.owner === workflow
      ? feedback
      : { busy: false, error: '', uncertain: false };
  async function run(action: () => Promise<unknown>) {
    if (visible.busy || workflow.busy || current.current !== workflow)
      return false;
    setFeedback({ owner: workflow, busy: true, error: '', uncertain: false });
    let message = '';
    try {
      await action();
      return current.current === workflow;
    } catch (error) {
      message =
        error instanceof Error ? error.message : 'Pièce jointe indisponible.';
      return false;
    } finally {
      if (current.current === workflow)
        setFeedback({
          owner: workflow,
          busy: false,
          error: message,
          uncertain: workflow.uncertain,
        });
    }
  }
  useEffect(
    () => () => {
      void workflow.dispose();
    },
    [workflow],
  );
  return {
    list,
    busy: visible.busy,
    error: visible.error,
    uncertain: visible.uncertain,
    upload: (input: AttachmentUpload, usage?: AttachmentUsage) =>
      run(() => workflow.upload(input, usage ?? list.data?.usage)),
    remove: (
      id: string,
      revision: number,
      reason: string,
      confirmed: boolean,
    ) =>
      run(() =>
        workflow.remove(id, classification, revision, reason, confirmed),
      ),
    retry: () => run(workflow.retry),
    content: workflow.content,
    historyQuery: workflow.historyQuery,
  };
}
