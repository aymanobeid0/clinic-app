import { defineConfig } from 'prisma/config';
export default defineConfig({ schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations' }, datasource: { url: process.env.DATABASE_URL ?? 'postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7' } });
