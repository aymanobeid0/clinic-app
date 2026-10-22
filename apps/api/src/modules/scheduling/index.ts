import { SchedulingRepository } from "./scheduling.repository.js";
import type { IdentityAccess } from '../identity/index.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { SchedulingService } from './scheduling.service.js';
import { SchedulingController } from './scheduling.controller.js';
import { schedulingRoutes } from './scheduling.routes.js';
export function createSchedulingRoutes(
  identity: IdentityAccess,
  updates: ClinicUpdates,
  now: () => number,
) {
  return schedulingRoutes(
    new SchedulingController(new SchedulingService(identity, updates, now), updates, now),
  );
}

export { visitAppointments, transitionVisitAppointment } from './scheduling.service.js';

export async function reportAppointments(tx: import('../../database.js').ClinicTransaction, clinicId:string, accountId:string, date:string, patientIds:string[] | null) {
  const rows=await new SchedulingRepository(tx,clinicId,accountId,Date.now).agenda(date);
  return rows.filter(a=>patientIds === null || patientIds.includes(a.patientId));
}
