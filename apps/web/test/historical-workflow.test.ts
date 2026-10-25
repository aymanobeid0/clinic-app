import { afterEach, expect, test, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { createHistoricalWorkflow } from '../src/features/clinical/historical.workflow.js';
afterEach(() => vi.unstubAllGlobals());
test('historical access denial removes the previously cached snapshot', async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const workflow = createHistoricalWorkflow(cache, 'clinic:doctor');
  const query = workflow.snapshotQuery('patient');
  cache.setQueryData(query.queryKey, {
    cutoff: '2026-10-01T00:00:00Z',
    clinical: [],
  });
  vi.stubGlobal('fetch', async (url: string) =>
    url === '/api/session'
      ? Response.json({ csrfToken: 'fictional' })
      : Response.json({ error: 'Accès révoqué.' }, { status: 403 }),
  );
  await expect(query.queryFn()).rejects.toThrow('Accès révoqué.');
  expect(cache.getQueryData(query.queryKey)).toBeUndefined();
  cache.clear();
});

test('historical version selection uses only revisions delivered in the server cutoff snapshot', async () => {
  const cache = new QueryClient();
  const workflow = createHistoricalWorkflow(cache, 'clinic:doctor');
  vi.stubGlobal('fetch', async () =>
    Response.json({
      cutoff: '2026-10-01T00:00:00Z',
      clinical: [
        {
          kind: 'history',
          versions: [
            {
              revision: 1,
              content: { medicalHistory: 'Version au retrait', allergies: '' },
            },
          ],
        },
      ],
    }),
  );
  const snapshot = await workflow.snapshotQuery('patient').queryFn();
  expect(snapshot.cutoff).toBe('2026-10-01T00:00:00Z');
  expect(workflow.version(snapshot, 'history', 1)?.content).toMatchObject({
    medicalHistory: 'Version au retrait',
  });
  expect(workflow.version(snapshot, 'history', 2)).toBeUndefined();
  await workflow.dispose();
  cache.clear();
});

test('a mounted historical observer discards its snapshot and surfaces grant revocation', async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const workflow = createHistoricalWorkflow(cache, 'clinic:doctor');
  const query = workflow.snapshotQuery('patient');
  cache.setQueryData(query.queryKey, {
    cutoff: '2026-10-01T00:00:00Z',
    clinical: [],
  });
  vi.stubGlobal('fetch', async () =>
    Response.json({ error: 'Accès révoqué.' }, { status: 403 }),
  );
  const observer = new QueryObserver(cache, { ...query, staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  await observer.refetch();
  expect(observer.getCurrentResult().data).toBeUndefined();
  expect(observer.getCurrentResult().error?.message).toBe('Accès révoqué.');
  unsubscribe();
  cache.clear();
});
