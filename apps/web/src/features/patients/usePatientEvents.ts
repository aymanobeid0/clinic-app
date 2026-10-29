import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
// Keeps patient reads current and drops them when the page or account changes.
export function usePatientEvents(read: boolean, accountKey: string) {
  const cache = useQueryClient();
  useEffect(() => {
    if (!read) return;
    const stream = new EventSource('/api/patients/events');
    const refresh = () => {
      void cache.invalidateQueries({ queryKey: ['patients', accountKey] });
    };
    stream.addEventListener('invalidate', refresh);
    stream.onopen = refresh;
    stream.onerror = () => {
      refresh();
      void cache.invalidateQueries({ queryKey: ['identity'] });
    };
    return () => {
      stream.close();
      void cache.cancelQueries({ queryKey: ['patients', accountKey] });
      cache.removeQueries({ queryKey: ['patients', accountKey] });
    };
  }, [read, accountKey, cache]);
}
