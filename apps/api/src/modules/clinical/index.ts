import type { IdentityAccess } from '../identity/index.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { ClinicalController } from './clinical.controller.js';
import { NoteService } from './note.service.js';
import { ClinicalService } from './clinical.service.js';
import { clinicalRoutes } from './clinical.routes.js';
export function createClinicalRoutes(
  identity: IdentityAccess,
  updates: ClinicUpdates,
  now: () => number,
) {
  return clinicalRoutes(
    new ClinicalController(
      new ClinicalService(identity, updates, now),
      new NoteService(identity, updates, now),
      updates,
      now,
    ),
  );
}
