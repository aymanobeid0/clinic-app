import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { openDatabase } from '../src/database.js';

const url =
  process.env.TEST_DATABASE_URL ??
  `postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`;
const parsed = new URL(url);
if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/clinic_issue7') {
  throw new Error('Dedicated local fictional test database required.');
}
// Validate before invoking Prisma. An ambient live DATABASE_URL must never
// redirect this test-only preparation command to another database.
const migration = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)),
    'migrate',
    'deploy',
  ],
  {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  },
);
if (migration.status !== 0) throw new Error('Test migration failed.');
const db = openDatabase(url);
try {
  await db.connect();
  await db.pool.query(
    await readFile(new URL('../../../infra/test-runtime.sql', import.meta.url), 'utf8'),
  );
} finally {
  await db.close();
}
