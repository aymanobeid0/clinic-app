import { randomBytes } from 'node:crypto';
import type { RequestHandler } from 'express';
import {
  signInSchema,
  replacePasswordSchema,
  requestVerificationSchema,
  verifyEmailSchema,
  regenerateCodesSchema,
  confirmCodesSchema,
} from '@clinic/contracts';
import type { IdentityService, Actor } from './identity.service.js';

declare module 'express-session' {
  interface SessionData {
    actor?: Actor;
    csrfToken?: string;
    startedAt?: number;
  }
}

type HttpOptions = { now: () => number; origin: string; secureCookies: boolean };

export class IdentityController {
  constructor(
    private readonly service: IdentityService,
    private readonly options: HttpOptions,
  ) {}

  session: RequestHandler = (req, res) => {
    req.session.startedAt ??= this.options.now();
    req.session.csrfToken ??= randomBytes(32).toString('hex');
    res.json({ csrfToken: req.session.csrfToken });
  };

  signIn: RequestHandler = async (req, res) => {
    const input = signInSchema.parse(req.body);
    const result = await this.service.signIn(input);
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.actor = result.actor;
    req.session.startedAt = this.options.now();
    req.session.csrfToken = randomBytes(32).toString('hex');
    res.json({ stage: result.stage, csrfToken: req.session.csrfToken });
  };

  identity: RequestHandler = async (req, res) => {
    res.json(await this.service.getIdentity(req.session.actor));
  };

  clinic: RequestHandler = async (req, res) => {
    res.json(await this.service.getClinic(req.session.actor));
  };

  replacePassword: RequestHandler = async (req, res) => {
    const { password } = replacePasswordSchema.parse(req.body);
    await this.service.replaceTemporaryPassword(req.session.actor, password);
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((error) => (error ? reject(error) : resolve()));
    });
    res.clearCookie('clinic.sid', this.cookieOptions()).status(204).end();
  };

  requestVerification: RequestHandler = async (req, res) => {
    const { email } = requestVerificationSchema.parse(req.body);
    await this.service.sendEmailVerification(req.session.actor, email);
    res.status(202).end();
  };

  verifyEmail: RequestHandler = async (req, res) => {
    const { token } = verifyEmailSchema.parse(req.body);
    res.json(await this.service.verifyEmail(req.session.actor, token));
  };

  regenerateCodes: RequestHandler = async (req, res) => {
    const { password } = regenerateCodesSchema.parse(req.body);
    res.json(await this.service.regenerateCodes(req.session.actor, password));
  };

  confirmSavedCodes: RequestHandler = async (req, res) => {
    const { batchId } = confirmCodesSchema.parse(req.body);
    await this.service.confirmSavedCodes(req.session.actor, batchId);
    res.status(204).end();
  };

  signOut: RequestHandler = async (req, res) => {
    // Keep the explicit origin/CSRF checks at this consequential session endpoint
    // as well as the shared browser-write middleware.
    if (
      req.get('origin') !== this.options.origin ||
      req.get('sec-fetch-site') === 'cross-site' ||
      !req.session.csrfToken ||
      req.get('x-csrf-token') !== req.session.csrfToken
    ) {
      res.status(403).json({ error: 'Requête non autorisée.' });
      return;
    }
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((error) => (error ? reject(error) : resolve()));
    });
    res.clearCookie('clinic.sid', this.cookieOptions()).status(204).end();
  };

  private cookieOptions() {
    return { httpOnly: true, sameSite: 'lax' as const, secure: this.options.secureCookies };
  }
}
