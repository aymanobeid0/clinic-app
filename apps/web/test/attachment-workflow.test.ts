import { afterEach, expect, test, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { createAttachmentWorkflow } from '../src/features/attachments/attachment.workflow.js';

afterEach(() => vi.unstubAllGlobals());

test('a lost upload response retains the original binary command for an explicit retry', async () => {
  const cache = new QueryClient();
  const requests: { url: string; bytes: string }[] = [];
  let lost = true;
  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    requests.push({ url, bytes: await (options.body as Blob).text() });
    if (lost) {
      lost = false;
      throw new TypeError('Network unavailable');
    }
    return Response.json({ id: 'retained-file', revision: 1 });
  });
  const workflow = createAttachmentWorkflow(cache, 'clinic:actor', 'patient');
  await expect(
    workflow.upload({
      file: new Blob(['%PDF-fictional'], { type: 'application/pdf' }),
      name: 'Fictif.pdf',
      classification: 'clinical',
    }),
  ).rejects.toThrow('Network unavailable');
  expect(workflow.uncertain).toBe(true);
  await expect(workflow.retry()).resolves.toMatchObject({ revision: 1 });
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(workflow.uncertain).toBe(false);
  cache.clear();
});

test('quota feedback blocks a new upload while retained content remains readable', async () => {
  const cache = new QueryClient();
  const workflow = createAttachmentWorkflow(cache, 'clinic:actor', 'patient');
  vi.stubGlobal(
    'fetch',
    async () => new Response(new Blob(['retained'], { type: 'image/png' })),
  );
  await expect(
    workflow.upload(
      {
        file: new Blob(['new']),
        name: 'Fictif.png',
        classification: 'clinical',
      },
      {
        retainedBytes: 1999999999,
        reservedBytes: 0,
        limitBytes: 2000000000,
        fileLimitBytes: 20000000,
      },
    ),
  ).rejects.toThrow('Quota de stockage atteint');
  expect(workflow.uncertain).toBe(false);
  expect(await (await workflow.content('retained', 1, 'clinical')).text()).toBe(
    'retained',
  );
  await workflow.dispose();
  cache.clear();
});

test('a mounted attachment list reports denied access without retaining old filenames', async () => {
  const cache = new QueryClient();
  const workflow = createAttachmentWorkflow(cache, 'clinic:actor', 'patient');
  const query = workflow.listQuery('clinical');
  cache.setQueryData(query.queryKey, {
    attachments: [{ name: 'Secret fictif.png' }],
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
  await workflow.dispose();
  cache.clear();
});

test('disposing a patient workflow releases its pending file and prevents later upload retries', async () => {
  const cache = new QueryClient();
  vi.stubGlobal('fetch', async () => {
    throw new TypeError('Network unavailable');
  });
  const workflow = createAttachmentWorkflow(cache, 'clinic:actor', 'patient');
  await expect(
    workflow.upload({
      file: new Blob(['fictif'], { type: 'application/pdf' }),
      name: 'Fictif.pdf',
      classification: 'clinical',
    }),
  ).rejects.toThrow();
  await workflow.dispose();
  expect(workflow.uncertain).toBe(false);
  await expect(
    workflow.upload({
      file: new Blob(['fictif']),
      name: 'Autre.pdf',
      classification: 'clinical',
    }),
  ).rejects.toThrow('Dossier fermé');
  cache.clear();
});
