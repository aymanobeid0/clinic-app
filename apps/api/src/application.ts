import { randomBytes } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import type { Database } from './database.js';

declare module 'express-session' {
  interface SessionData { csrfToken?: string; startedAt?: number }
}

type Options = {
  database: Database;
  sessionSecret: string;
  origin: string;
  secureCookies: boolean;
  now?: () => number;
};

export function createApplication(options: Options) {
  if (options.sessionSecret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const origin = new URL(options.origin).origin;
  const now = options.now ?? Date.now;
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
  const PgStore = connectPgSimple(session);
  app.use(session({
    name: 'clinic.sid',
    secret: options.sessionSecret,
    store: new PgStore({ pool: options.database.pool, createTableIfMissing: false, pruneSessionInterval: false }),
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: options.secureCookies, maxAge: 12 * 60 * 60 * 1000 },
  }));

  app.use((req, _res, next) => {
    if (req.session.startedAt !== undefined && now() - req.session.startedAt >= 12 * 60 * 60 * 1000) {
      req.session.regenerate(next);
      return;
    }
    next();
  });

  // Establish only anonymous browser-session state. No clinic data or membership.
  app.get('/api/session', (req, res) => {
    req.session.startedAt ??= now();
    req.session.csrfToken ??= randomBytes(32).toString('hex');
    res.set('Cache-Control', 'no-store').json({ csrfToken: req.session.csrfToken });
  });

  // Authentication is deliberately not granted by this first session-boundary slice.
  app.get('/api/identity', (_req, res) => {
    res.set('Cache-Control', 'no-store').status(401).json({ error: 'Connexion requise.' });
  });

  app.post('/api/sign-out', (req, res, next) => {
    if (req.get('origin') !== origin || req.get('sec-fetch-site') === 'cross-site' ||
        !req.session.csrfToken || req.get('x-csrf-token') !== req.session.csrfToken) {
      res.status(403).json({ error: 'Requête non autorisée.' });
      return;
    }
    req.session.destroy((error) => {
      if (error) { next(error); return; }
      res.clearCookie('clinic.sid', { httpOnly: true, sameSite: 'lax', secure: options.secureCookies });
      res.status(204).end();
    });
  });

  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error?.status === 400 || error?.status === 413 ? error.status : 500;
    const message = status === 500 ? 'Service temporairement indisponible.' : 'Requête invalide.';
    res.status(status).json({ error: message });
  };
  app.use(errors);
  return app;
}
