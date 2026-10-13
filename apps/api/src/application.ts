import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createIdentityRoutes, createIdentityAccess, type Mail } from './modules/identity/index.js';
import { createPatientRoutes } from './modules/patients/index.js';
import { browserSession, enforceSessionAge } from './middleware/session.js';
import { requireBrowserWrite } from './middleware/csrf.js';
import { handleErrors } from './middleware/errors.js';
import type { Database } from './database.js';

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
    createPatientRoutes(createIdentityAccess(config.database, config.now), config.now),
  );
  app.use(handleErrors);
  return app;
}
