import { provisionClinic } from './modules/identity/index.js';
import { openDatabase } from './database.js';

// Operator-only process; never mounted as an HTTP endpoint. Secrets enter via stdin.
const url = process.env.PROVISION_DATABASE_URL;
if (!url) throw new Error('PROVISION_DATABASE_URL is required for operator provisioning.');
const database = openDatabase(url);
try {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk.toString();
    if (input.length > 4096) throw new Error('Provisioning input too large.');
  }
  await database.connect();
  await provisionClinic(database, JSON.parse(input));
  process.stdout.write('Clinic and temporary manager provisioned.\n');
} catch {
  process.stderr.write(
    'Provisioning failed. Check input, operator permissions and clinic-code uniqueness.\n',
  );
  process.exitCode = 1;
} finally {
  await database.close();
}
