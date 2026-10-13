import type { AccountController } from './account.controller.js';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { signInSchema, recoveryIdentitySchema } from '@clinic/contracts';
import type { IdentityController } from './identity.controller.js';

export function identityRoutes(controller: IdentityController, accounts: AccountController) {
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

  const recoveryLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const input = recoveryIdentitySchema.safeParse(req.body?.identity);
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
  router.post('/email', controller.changeEmail);
  router.post('/password', controller.changePassword);
  router.post('/recovery/code', recoveryLimit, controller.recoverCode);
  router.post('/recovery/request', recoveryLimit, controller.requestRecovery);
  router.post('/recovery/email', recoveryLimit, controller.recoverEmail);
  router.get('/identity', controller.identity);
  router.get('/clinic', controller.clinic);
  router.post('/onboarding/password', controller.replacePassword);
  router.post('/onboarding/email', controller.requestVerification);
  router.post('/onboarding/verify-email', controller.verifyEmail);
  router.post('/onboarding/codes', controller.regenerateCodes);
  router.post('/onboarding/codes-saved', controller.confirmSavedCodes);
  router.get('/accounts', accounts.list);
  router.post('/accounts', accounts.create);
  router.post('/accounts/:id/username', accounts.rename);
  router.post('/accounts/:id/permissions', accounts.permissions);
  router.post('/accounts/:id/kind', accounts.kind);
  router.post('/accounts/:id/manager', accounts.manager);
  router.post('/accounts/:id/status', accounts.status);
  router.post('/accounts/:id/reset-password', accounts.reset);
  return router;
}
