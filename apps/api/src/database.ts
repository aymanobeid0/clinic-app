import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from './generated/prisma/client.js';

export function openDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000 });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });
  return {
    client,
    pool,
    async connect() { await client.$connect(); await pool.query('SELECT 1'); },
    async close() { await client.$disconnect(); await pool.end(); },
  };
}
export type Database = ReturnType<typeof openDatabase>;
