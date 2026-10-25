import { useEffect, useRef } from 'react';

// A workflow belongs to one mounted hook. StrictMode immediately replays
// setup after cleanup; only a cleanup not reclaimed by setup closes it.
export function useWorkflowLifetime<T extends { dispose: () => Promise<void> }>(
  workflow: T,
) {
  const current = useRef<T | undefined>(workflow);
  current.current = workflow;
  useEffect(() => {
    current.current = workflow;
    return () => {
      if (current.current === workflow) current.current = undefined;
      queueMicrotask(() => {
        if (current.current !== workflow) void workflow.dispose();
      });
    };
  }, [workflow]);
  return current;
}
