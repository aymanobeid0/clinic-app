import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../src/application.js';
import { openDatabase } from '../src/database.js';

const testUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7';
const parsedUrl = new URL(testUrl);
if (!['localhost', '127.0.0.1'].includes(parsedUrl.hostname) || parsedUrl.pathname !== '/clinic_issue7') {
  throw new Error('Tests require the dedicated local clinic_issue7 fictional-data database.');
}

describe('persistent identity boundary', () => {
  const database = openDatabase(testUrl);
  const options = { database, sessionSecret: 'fictional-test-session-secret-at-least-32-characters', origin: 'http://localhost:4173', secureCookies: false };
  const application = createApplication(options);
  beforeAll(async () => { await database.connect(); });
  afterAll(async () => { await database.close(); });

  it('rejects clinic access without an authenticated manager session', async () => {
    const response = await request(application).get('/api/identity');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Connexion requise.' });
  });

  it('keeps the anonymous CSRF session when the application is recreated', async () => {
    const first = await request(application).get('/api/session');
    expect(first.status).toBe(200);
    expect(first.body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    expect(first.headers['cache-control']).toBe('no-store');
    const cookies = [first.headers['set-cookie']].flat();
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('SameSite=Lax');
    const recreated = createApplication(options);
    const second = await request(recreated).get('/api/session').set('Cookie', cookies);
    expect(second.body.csrfToken).toBe(first.body.csrfToken);
    const identity = await request(recreated).get('/api/identity').set('Cookie', cookies);
    expect(identity.status).toBe(401);
  });

  it('rejects forged sign-out and invalidates a valid session in persistent storage', async () => {
    const browser = request.agent(application);
    const initial = await browser.get('/api/session');
    expect((await browser.post('/api/sign-out').set('Origin', options.origin)).status).toBe(403);
    expect((await browser.post('/api/sign-out').set('Origin', 'https://attacker.invalid').set('x-csrf-token', initial.body.csrfToken)).status).toBe(403);
    expect((await browser.post('/api/sign-out').set('Origin', options.origin).set('x-csrf-token', 'wrong-token')).status).toBe(403);
    expect((await browser.post('/api/sign-out').set('Origin', options.origin).set('Sec-Fetch-Site', 'cross-site').set('x-csrf-token', initial.body.csrfToken)).status).toBe(403);
    const signedOut = await browser.post('/api/sign-out').set('Origin', options.origin).set('x-csrf-token', initial.body.csrfToken);
    expect(signedOut.status).toBe(204);
    const replay = await request(application).get('/api/session').set('Cookie', initial.headers['set-cookie']);
    expect(replay.body.csrfToken).not.toBe(initial.body.csrfToken);
  });

  it('invalidates replay after twelve hours even when the browser retains the cookie', async () => {
    let time = 1000;
    const timedApplication = createApplication({ ...options, now: () => time });
    const first = await request(timedApplication).get('/api/session');
    time += 12 * 60 * 60 * 1000;
    const replay = await request(timedApplication).get('/api/session').set('Cookie', first.headers['set-cookie']);
    expect(replay.body.csrfToken).not.toBe(first.body.csrfToken);
  });

  it('returns client errors for malformed and oversized JSON', async () => {
    const malformed = await request(application).post('/api/sign-out').set('Content-Type', 'application/json').send('{');
    expect(malformed.status).toBe(400);
    const oversized = await request(application).post('/api/sign-out').send({ value: 'x'.repeat(20_000) });
    expect(oversized.status).toBe(413);
    expect(oversized.body).toEqual({ error: 'Requête invalide.' });
  });

  it('exposes no public clinic or manager registration endpoint', async () => {
    expect((await request(application).post('/api/register').send({ clinicCode: 'fictional' })).status).toBe(404);
  });
});
