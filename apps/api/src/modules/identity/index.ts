import { AccountService } from './account.service.js';
import { AccountController } from './account.controller.js';
import type { z } from 'zod';
import type { provisionClinicSchema } from '@clinic/contracts';
import type { Database } from '../../database.js';
import { IdentityController } from './identity.controller.js';
import { IdentityRepository } from './identity.repository.js';
import { IdentityService, type Mail } from './identity.service.js';
import { identityRoutes } from './identity.routes.js';
export { IdentityError, type Mail } from './identity.service.js';
export type { Actor } from './identity.service.js';

// Permission checks and consuming-module writes share the identity transaction.
export function createIdentityAccess(database: Database, now: () => number) {
  const service = new IdentityService(new IdentityRepository(database), now, '');
  return { withPermission: service.withPermission.bind(service) };
}
export type IdentityAccess = ReturnType<typeof createIdentityAccess>;

type Options = {
  database: Database;
  now: () => number;
  origin: string;
  secureCookies: boolean;
  mail?: Mail;
};
export function createIdentityRoutes(options: Options) {
  const repository = new IdentityRepository(options.database);
  const service = new IdentityService(repository, options.now, options.origin, options.mail);
  const controller = new IdentityController(service, options);
  return identityRoutes(
    controller,
    new AccountController(new AccountService(service, options.now)),
  );
}

// Separate operator entry point: not reachable through the HTTP router.
export function provisionClinic(
  database: Database,
  input: z.input<typeof provisionClinicSchema>,
  now = Date.now(),
) {
  return new IdentityService(new IdentityRepository(database), () => now, '').provisionClinic(
    input,
  );
}
