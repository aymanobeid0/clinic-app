import type { ProcedureStart } from "@clinic/contracts";
import type { ClinicTransaction } from "../../database.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import type { IdentityAccess } from "../identity/index.js";
import { BillingRepository } from "./billing.repository.js";
import { BillingService } from "./billing.service.js";
import { BillingController } from "./billing.controller.js";
import { billingRoutes } from "./billing.routes.js";
export function createBillingRoutes(
  identity: IdentityAccess,
  updates: ClinicUpdates,
  now: () => number,
) {
  return billingRoutes(
    new BillingController(new BillingService(identity, updates, now)),
  );
}
export function createProcedureCharge(
  tx: ClinicTransaction,
  clinicId: string,
  event: ProcedureStart,
) {
  return new BillingRepository(tx, clinicId).charge(event);
}
