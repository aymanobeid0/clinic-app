import { VisitService } from './visit.service.js';
import { TreatmentRepository } from './treatment.repository.js';
import type { IdentityAccess } from '../identity/index.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { TreatmentController } from './treatment.controller.js';
import { TreatmentService } from './treatment.service.js';
import { treatmentRoutes } from './treatment.routes.js';
export function createTreatmentRoutes(
  identity: IdentityAccess,
  updates: ClinicUpdates,
  now: () => number,
) {
  return treatmentRoutes(
    new TreatmentController(
      new TreatmentService(identity, updates, now),
      new VisitService(identity, updates, now),
      updates,
      now,
    ),
  );
}
// Public scheduling projection deliberately excludes prices and patient content.
export async function procedureDurations(
  tx: import('../../database.js').ClinicTransaction,
  clinicId: string,
) {
  return new TreatmentRepository(tx, clinicId).durations();
}

export { recordProcedureStart } from './procedure-start.js';
