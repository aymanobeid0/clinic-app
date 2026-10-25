import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clinicalApi } from './clinical.api.js';
export function useClinicalRecord(id: string, accountKey: string) {
  const cache = useQueryClient();
  const key = ['clinical', accountKey, id];
  const [connected, setConnected] = useState(true);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => clinicalApi.get(id, signal),
    gcTime: 0,
    retry: false,
  });
  useEffect(() => {
    const stream = new EventSource(`/api/clinical/${id}/events`);
    const refresh = () => {
      setConnected(true);
      void cache.invalidateQueries({ queryKey: ['clinical', accountKey, id] });
      void cache.invalidateQueries({
        queryKey: ['clinical-patients', accountKey],
      });
    };
    stream.addEventListener('invalidate', (event) => {
      const scope = (
        JSON.parse((event as MessageEvent<string>).data) as { scope?: string }
      ).scope;
      if (scope === 'prescriptions')
        void cache.invalidateQueries({ queryKey: ['prescriptions'] });
      else if (scope === 'medications')
        void cache.invalidateQueries({ queryKey: ['medications'] });
      else if (scope === 'suggestions')
        void cache.invalidateQueries({ queryKey: ['chart-suggestions'] });
      else if (scope === 'chart')
        void cache.invalidateQueries({
          queryKey: ['clinical', accountKey, id],
        });
      else refresh();
    });
    stream.onopen = () => {
      setConnected(true);
      void cache.invalidateQueries({ queryKey: ['prescriptions'] });
      void cache.invalidateQueries({ queryKey: ['chart-suggestions'] });
      void cache.invalidateQueries({ queryKey: ['medications'] });
    };
    stream.onerror = () => {
      setConnected(false);
      void cache.invalidateQueries({ queryKey: ['clinical', accountKey, id] });
    };
    return () => {
      stream.close();
      void cache.cancelQueries({ queryKey: ['clinical', accountKey, id] });
      cache.removeQueries({ queryKey: ['clinical', accountKey, id] });
    };
  }, [id, accountKey, cache]);
  return { key, connected, query };
}
