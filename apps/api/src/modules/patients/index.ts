import type { IdentityAccess } from '../identity/index.js';
import { PatientService } from './patient.service.js';
import { PatientController } from './patient.controller.js';
import { patientRoutes } from './patient.routes.js';
import { PatientUpdates } from './patient.updates.js';
export function createPatientRoutes(identity: IdentityAccess, now: () => number) {
  const updates = new PatientUpdates();
  return patientRoutes(
    new PatientController(new PatientService(identity, now, updates), updates, now),
  );
}
