import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { signInSchema } from '@clinic/contracts';
import type { IdentityController } from './identity.controller.js';

export function identityRoutes(controller: IdentityController) {
  const router = Router();
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const input = signInSchema.safeParse(req.body);
      if (!input.success) return 'invalid';
      return input.data.method === 'email'
        ? `email:${input.data.email}`
        : `clinic:${input.data.clinicCode}:${input.data.username}`;
    },
    message: { error: 'Trop de tentatives. Réessayez plus tard.' },
  });

  router.get('/session', controller.session);
  router.post('/sign-in', loginLimit, controller.signIn);
  router.post('/sign-out', controller.signOut);
  router.get('/identity', controller.identity);
  router.get('/clinic', controller.clinic);
  router.post('/onboarding/password', controller.replacePassword);
  router.post('/onboarding/email', controller.requestVerification);
  router.post('/onboarding/verify-email', controller.verifyEmail);
  router.post('/onboarding/codes', controller.regenerateCodes);
  router.post('/onboarding/codes-saved', controller.confirmSavedCodes);
  return router;
}
