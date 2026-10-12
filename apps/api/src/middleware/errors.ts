import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { IdentityError } from '../modules/identity/index.js';
export const handleErrors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof IdentityError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Requête invalide.' });
    return;
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
    res.status(409).json({ error: 'Cette valeur est déjà utilisée.' });
    return;
  }
  const status = error?.status === 400 || error?.status === 413 ? error.status : 500;
  const message = status === 500 ? 'Service temporairement indisponible.' : 'Requête invalide.';
  res.status(status).json({ error: message });
};
