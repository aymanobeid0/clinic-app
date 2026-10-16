import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient, type Prisma } from './generated/prisma/client.js';

export function openDatabase(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
  });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });
  return {
    client,
    pool,
    clinicTransaction<T>(clinicId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
      return client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.clinic_id', ${clinicId}, true)`;
        return action(tx);
      });
    },
    async connect() {
      await client.$connect();
      await pool.query('SELECT 1');
    },
    async assertRuntimeRole() {
      const result = await pool.query<{ unsafe: boolean }>(`
        SELECT (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR
          NOT pg_has_role(current_user, 'clinic_runtime', 'MEMBER') OR EXISTS (
            SELECT 1 FROM pg_class c WHERE c.relname IN ('Clinic', 'Account', 'RecoveryCode', 'ReservedUsername', 'Patient', 'PatientHistory', 'PatientAccessState', 'PatientGrant', 'PatientAccessHistory', 'ClinicalRevision', 'ClinicCurrency', 'CatalogProcedure', 'TreatmentCommand', 'TreatmentPlanRevision', 'TreatmentPlanIdentity', 'session')
            AND c.relnamespace = 'public'::regnamespace AND pg_has_role(current_user, c.relowner, 'MEMBER')
          )) AS unsafe FROM pg_roles r WHERE r.rolname = current_user`);
      if (result.rows[0]?.unsafe !== false)
        throw new Error('API requires a restricted non-owner clinic_runtime login.');
    },
    async close() {
      await client.$disconnect();
      await pool.end();
    },
  };
}
export type Database = ReturnType<typeof openDatabase>;
export type ClinicTransaction = Prisma.TransactionClient;
