import pino from 'pino';
import { createApplication } from './application.js';
import { openDatabase } from './database.js';

const { DATABASE_URL, SESSION_SECRET, APP_ORIGIN } = process.env;
if (!DATABASE_URL || !SESSION_SECRET || !APP_ORIGIN) {
  throw new Error('DATABASE_URL, SESSION_SECRET and APP_ORIGIN are required.');
}
if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'false') {
  throw new Error('Production requires secure cookies.');
}
const log = pino();
const database = openDatabase(DATABASE_URL);
await database.connect();
const application = createApplication({ database, sessionSecret: SESSION_SECRET, origin: APP_ORIGIN, secureCookies: process.env.COOKIE_SECURE !== 'false' });
const server = application.listen(Number(process.env.PORT ?? 3000), '127.0.0.1', () => log.info('Clinic API listening.'));
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.close(async () => { await database.close(); });
  setTimeout(() => { process.exitCode = 1; server.closeAllConnections(); }, 10_000).unref();
}
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
