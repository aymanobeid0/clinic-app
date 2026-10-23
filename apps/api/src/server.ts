import { logger as log } from './logger.js';
import { createApplication } from './application.js';
import { openDatabase } from './database.js';
import { privateFileStore } from './modules/files/index.js';
import { cleanupExpiredExports } from './modules/exports/index.js';

const { DATABASE_URL, SESSION_SECRET, APP_ORIGIN } = process.env;
if (!DATABASE_URL || !SESSION_SECRET || !APP_ORIGIN) {
  throw new Error('DATABASE_URL, SESSION_SECRET and APP_ORIGIN are required.');
}
if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'false') {
  throw new Error('Production requires secure cookies.');
}
const database = openDatabase(DATABASE_URL);
await database.connect();
await database.assertRuntimeRole();
let cleaning=false;
const clean=async()=>{
  if(cleaning) return;
  cleaning=true;
  try {await cleanupExpiredExports(database);} catch {log.error('Expired export cleanup failed.');}
  finally {cleaning=false;}
};
await clean();
const exportCleanup=setInterval(()=>{void clean();},60_000);
exportCleanup.unref();
const application = createApplication({
  database,
  sessionSecret: SESSION_SECRET,
  origin: APP_ORIGIN,
  secureCookies: process.env.COOKIE_SECURE !== 'false',
  attachmentStore: process.env.ATTACHMENT_DIRECTORY ? privateFileStore(process.env.ATTACHMENT_DIRECTORY) : undefined,
});
const server = application.listen(Number(process.env.PORT ?? 3000), '127.0.0.1', () =>
  log.info('Clinic API listening.'),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(exportCleanup);
  server.close(async () => {
    await database.close();
  });
  setTimeout(() => {
    process.exitCode = 1;
    server.closeAllConnections();
  }, 10_000).unref();
}
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
