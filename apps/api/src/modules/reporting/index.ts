import type { ClinicUpdates } from "../../clinic-updates.js";
import type { IdentityAccess } from "../identity/index.js";
import { ReportingService } from "./reporting.service.js";
import { ReportingController } from "./reporting.controller.js";
import { reportingRoutes } from "./reporting.routes.js";
export function createReportingRoutes(
  identity: IdentityAccess,
  now: () => number,
  updates: ClinicUpdates,
) {
  return reportingRoutes(
    new ReportingController(
      new ReportingService(identity, now, updates),
      updates,
      now,
    ),
  );
}
