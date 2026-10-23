import type { IdentityAccess } from '../identity/index.js';
import { PatientRepository } from './patient.repository.js';
import { PatientService } from './patient.service.js';
import { PatientController } from './patient.controller.js';
import { patientRoutes } from './patient.routes.js';
import { PatientUpdates } from './patient.updates.js';
export function createPatientRoutes(
  identity: IdentityAccess,
  now: () => number,
  updates: PatientUpdates,
) {
  return patientRoutes(
    new PatientController(new PatientService(identity, now, updates), updates, now),
  );
}
export async function capturePatient(tx:import('../../database.js').ClinicTransaction,clinicId:string,patientId:string) {
  return new PatientRepository(tx,clinicId,'',Date.now).get(patientId);
}
export async function exportPatient(tx:import('../../database.js').ClinicTransaction,clinicId:string,patientId:string) {
  const repository=new PatientRepository(tx,clinicId,'',Date.now);
  return {patient:await repository.get(patientId),history:await repository.exportHistory(patientId)};
}
