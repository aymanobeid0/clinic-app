import {createTreatmentRoutes} from './modules/treatment/index.js';
import { createBillingRoutes } from './modules/billing/index.js';
import { createClinicalRoutes } from './modules/clinical/index.js';
import { createSchedulingRoutes } from './modules/scheduling/index.js';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createIdentityRoutes, createIdentityAccess, type Mail } from './modules/identity/index.js';
import { createPatientRoutes } from './modules/patients/index.js';
import { browserSession, enforceSessionAge } from './middleware/session.js';
import { requireBrowserWrite } from './middleware/csrf.js';
import { handleErrors } from './middleware/errors.js';
import type { Database } from './database.js';
import { ClinicUpdates } from './clinic-updates.js';

type Options = {
  database: Database;
  sessionSecret: string;
  origin: string;
  secureCookies: boolean;
  now?: () => number;
  mail?: Mail;
};

export function createApplication(options: Options) {
  if (options.sessionSecret.length < 32)
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const config = {
    ...options,
    origin: new URL(options.origin).origin,
    now: options.now ?? Date.now,
    updates: new ClinicUpdates(),
  };
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  app.use(browserSession(config));
  app.use(enforceSessionAge(config.now));
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', requireBrowserWrite(config.origin));
  app.use('/api', createIdentityRoutes(config));
  app.use(
    '/api',
    createPatientRoutes(
      createIdentityAccess(config.database, config.now),
      config.now,
      config.updates,
    ),
  );
  app.use('/api', createSchedulingRoutes(createIdentityAccess(config.database, config.now), config.updates, config.now));
  app.use('/api', createClinicalRoutes(createIdentityAccess(config.database, config.now), config.updates, config.now));
  app.use('/api',createTreatmentRoutes(createIdentityAccess(config.database,config.now),config.updates,config.now));
  app.use('/api', createBillingRoutes(createIdentityAccess(config.database, config.now), config.updates, config.now));
  app.use(handleErrors);
  return app;
}
