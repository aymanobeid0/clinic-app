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
