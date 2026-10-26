import type { RequestHandler } from 'express';
export function requireBrowserWrite(origin: string): RequestHandler {
  return (req, res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.path !== '/register' &&
      (req.get('origin') !== origin ||
        req.get('sec-fetch-site') === 'cross-site' ||
        !req.session.csrfToken ||
        req.get('x-csrf-token') !== req.session.csrfToken)
    ) {
      res.status(403).json({ error: 'La vérification de sécurité a échoué. Actualisez la page avant de réessayer.' });
      return;
    }
    next();
  };
}
