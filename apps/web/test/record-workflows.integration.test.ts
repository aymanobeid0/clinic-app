import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { QueryClient } from '@tanstack/react-query';
import { createApplication } from '../../api/src/application.js';
import { openDatabase } from '../../api/src/database.js';
import { provisionClinic } from '../../api/src/modules/identity/index.js';
import { privateFileStore } from '../../api/src/modules/files/index.js';
import { refreshSession } from '../src/features/identity/identity.api.js';
import { createAttachmentWorkflow } from '../src/features/attachments/attachment.workflow.js';
import { createHistoricalWorkflow } from '../src/features/clinical/historical.workflow.js';

test('frontend attachment workflows cross real session/CSRF/authorization and retain replaced/removed bytes', async () => {
  // The test harness uses the existing suite DB name; its port must be bound
  // exclusively to the separate disposable clinic-issue54-test Docker project.
  const owner = openDatabase(
    'postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7',
  );
  const runtime = openDatabase(
    'postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:55437/clinic_issue7',
  );
  const directory = await mkdtemp(join(tmpdir(), 'clinic-issue54-'));
  const cache = new QueryClient();
  try {
    await owner.connect();
    await runtime.connect();
    const origin = 'http://localhost:4173';
    let token = '';
    const app = createApplication({
      database: runtime,
      origin,
      secureCookies: false,
      sessionSecret: 'fictional-issue54-session-secret-long-enough',
      attachmentStore: privateFileStore(directory),
      mail: {
        async sendVerification(message) {
          token = message.token;
        },
      },
    });
    const code = `r54-${randomUUID()}`.slice(0, 32),
      email = `${code}@example.invalid`,
      password = 'Fictional-records-personal';
    await provisionClinic(owner, {
      clinicCode: code,
      clinicName: 'Clinique fictive R54',
      username: 'manager',
      displayName: 'Responsable fictif',
      email,
      temporaryPassword: 'Fictional-records-initial',
    });
    const agent = request.agent(app);
    let csrf = (await agent.get('/api/session')).body.csrfToken;
    const post = (path: string, body: object) =>
      agent
        .post(`/api/${path}`)
        .set('Origin', origin)
        .set('x-csrf-token', csrf)
        .send(body);
    csrf = (
      await post('sign-in', {
        method: 'email',
        email,
        password: 'Fictional-records-initial',
      })
    ).body.csrfToken;
    await post('onboarding/password', { password });
    csrf = (await agent.get('/api/session')).body.csrfToken;
    csrf = (await post('sign-in', { method: 'email', email, password })).body
      .csrfToken;
    await post('onboarding/email', { email });
    const codes = await post('onboarding/verify-email', { token });
    await post('onboarding/codes-saved', {
      batchId: codes.body.batchId,
      saved: true,
    });
    const identity = (await agent.get('/api/identity')).body;
    expect(
      (
        await post(`accounts/${identity.accountId}/permissions`, {
          revision: 0,
          currentPassword: password,
          permissions: ['patients.create'],
        })
      ).status,
    ).toBe(200);
    const created = await post('patients', {
      commandId: randomUUID(),
      name: 'Patient R54 fictif',
      phone: '70000540',
      contactKind: 'patient',
      contactName: '',
    });
    expect(created.status).toBe(201);
    const patientId = created.body.patient.id;
    // Adapt only external fetch; keep the actual authenticated application,
    // restricted runtime role, PostgreSQL and private storage implementation.
    vi.stubGlobal('fetch', async (url: string, options: RequestInit = {}) => {
      const call = options.method === 'POST' ? agent.post(url) : agent.get(url);
      call.set('Origin', origin);
      new Headers(options.headers).forEach((value, key) =>
        call.set(key, value),
      );
      if (options.body instanceof Blob)
        call.send(Buffer.from(await options.body.arrayBuffer()));
      else if (typeof options.body === 'string')
        call.send(JSON.parse(options.body));
      const response = await call;
      return new Response(
        Buffer.isBuffer(response.body)
          ? new Uint8Array(response.body)
          : JSON.stringify(response.body),
        {
          status: response.status,
          headers: {
            'Content-Type':
              response.headers['content-type'] ?? 'application/json',
          },
        },
      );
    });
    await refreshSession();
    const workflow = createAttachmentWorkflow(
      cache,
      `${identity.clinicId}:${identity.accountId}`,
      patientId,
    );
    const png = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    const file = new Blob([new Uint8Array(png)], { type: 'image/png' });
    const original = await workflow.upload({
      file,
      name: 'Preuve fictive.png',
      classification: 'financial',
    });
    const replacement = await workflow.upload({
      file,
      name: 'Version fictive.png',
      classification: 'financial',
      attachmentId: original.id,
      revision: original.revision,
      reason: 'Correction fictive',
    });
    expect(replacement.revision).toBe(2);
    const history = await cache.fetchQuery(
      workflow.historyQuery(original.id, 'financial'),
    );
    expect(history.versions.map((version) => version.revision)).toEqual([1, 2]);
    expect((await workflow.content(original.id, 1, 'financial')).size).toBe(
      png.length,
    );
    expect(
      (await cache.fetchQuery(workflow.listQuery('financial'))).usage
        .retainedBytes,
    ).toBe(png.length * 2);
    await workflow.remove(original.id, 'financial', 2, 'Retrait fictif', true);
    expect(
      (await cache.fetchQuery(workflow.listQuery('financial'))).attachments,
    ).toEqual([]);
    expect((await workflow.content(original.id, 1, 'financial')).size).toBe(
      png.length,
    );
    const historical = createHistoricalWorkflow(cache, 'fictional-nondoctor');
    await expect(
      historical.snapshotQuery(patientId).queryFn(),
    ).rejects.toThrow();
    await workflow.dispose();
  } finally {
    vi.unstubAllGlobals();
    cache.clear();
    await runtime.close();
    await owner.close();
    await rm(directory, { recursive: true, force: true });
  }
});
