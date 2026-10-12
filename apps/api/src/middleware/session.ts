import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type { RequestHandler } from 'express';
import type { Database } from '../database.js';

type Options = {
  database: Database;
  sessionSecret: string;
  secureCookies: boolean;
  now: () => number;
};
export function browserSession(options: Options) {
  const PgStore = connectPgSimple(session);
  return session({
    name: 'clinic.sid',
    secret: options.sessionSecret,
    store: new PgStore({
      pool: options.database.pool,
      createTableIfMissing: false,
      pruneSessionInterval: false,
    }),
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: options.secureCookies,
      maxAge: 12 * 60 * 60 * 1000,
    },
  });
}
export function enforceSessionAge(now: () => number): RequestHandler {
  return (req, _res, next) => {
    if (
      req.session.startedAt !== undefined &&
      now() - req.session.startedAt >= 12 * 60 * 60 * 1000
    ) {
      req.session.regenerate(next);
      return;
    }
    next();
  };
}
