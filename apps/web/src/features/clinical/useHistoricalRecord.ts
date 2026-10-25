import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createHistoricalWorkflow } from './historical.workflow.js';
export function useHistoricalRecord(accountKey: string, patientId: string) {
  const cache = useQueryClient();
  const workflow = useMemo(
    () => createHistoricalWorkflow(cache, accountKey),
    [cache, accountKey],
  );
  const patients = useQuery(workflow.patientsQuery);
  const snapshot = useQuery({
    ...workflow.snapshotQuery(patientId),
    enabled: !!patientId,
  });
  useEffect(() => {
    if (!patientId) return;
    const stream = new EventSource(
      `/api/historical/${encodeURIComponent(patientId)}/events`,
    );
    const refresh = () => {
      void cache.invalidateQueries({ queryKey: ['historical', accountKey] });
    };
    stream.addEventListener('invalidate', refresh);
    stream.onopen = refresh;
    stream.onerror = refresh;
    return () => stream.close();
  }, [patientId, accountKey, cache]);
  useEffect(
    () => () => {
      void workflow.dispose();
    },
    [workflow],
  );
  return {
    patients,
    snapshot,
    version: workflow.version,
    attachment: workflow.attachment,
  };
}
