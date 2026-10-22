import { AccountService } from './account.service.js';
import { HistoricalController } from './historical.controller.js';
import { PatientAccessService } from './patient-access.service.js';
import { PatientAccessController } from './patient-access.controller.js';
import { ClinicUpdates } from '../../clinic-updates.js';
import { AccountController } from './account.controller.js';
import type { z } from 'zod';
import type { provisionClinicSchema } from '@clinic/contracts';
import type { Database } from '../../database.js';
import { IdentityController } from './identity.controller.js';
import { IdentityRepository } from './identity.repository.js';
import { IdentityService, type Mail } from './identity.service.js';
import { identityRoutes } from './identity.routes.js';
export type { Mail } from './identity.service.js';
export type { Actor } from './identity.service.js';

// Permission checks and consuming-module writes share the identity transaction.
export function createIdentityAccess(database: Database, now: () => number) {
  const service = new IdentityService(new IdentityRepository(database), now, '');
  return {
    withHistoricalFile: service.withHistoricalFile.bind(service),
    historicalSnapshot: service.historicalSnapshot.bind(service),
    withAttachmentPermission: service.withAttachmentPermission.bind(service),
    withReportScope: service.withReportScope.bind(service),
    withFinancialPermission: service.withFinancialPermission.bind(service),
    withMedicationReference: service.withMedicationReference.bind(service),
    withCatalogRead: service.withCatalogRead.bind(service),
    withPermission: service.withPermission.bind(service),
    withManager: service.withManager.bind(service),
    withPermissionOrManager: service.withPermissionOrManager.bind(service),
    withAssigner: service.withAssigner.bind(service),
    withClinicalPatients: service.withClinicalPatients.bind(service),
    withClinicalPermission: service.withClinicalPermission.bind(service),
  };
}
export type IdentityAccess = ReturnType<typeof createIdentityAccess>;

type Options = {
  database: Database;
  now: () => number;
  origin: string;
  secureCookies: boolean;
  mail?: Mail;
  updates: ClinicUpdates;
};
export function createIdentityRoutes(options: Options) {
  const repository = new IdentityRepository(options.database);
  const service = new IdentityService(
    repository,
    options.now,
    options.origin,
    options.mail,
    options.updates,
  );
  const controller = new IdentityController(service, options);
  const updates = options.updates;
  return identityRoutes(
    controller,
    new AccountController(new AccountService(service, options.now, updates)),
    new PatientAccessController(
      new PatientAccessService(service, options.now, updates),
      updates,
      options.now,
    ),
    new HistoricalController(service,updates,options.now),
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
export { onboardingStage as accountOnboardingStage } from './account-readiness.policy.js';
