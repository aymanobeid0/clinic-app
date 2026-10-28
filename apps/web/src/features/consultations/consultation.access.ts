import type { Identity } from "@clinic/contracts";
import { identityScope } from "../identity/identity.workflow.js";
export const consultationKey = (
  identity: Identity,
  patientId = "",
  accessScope = "active",
) => ["consultations", identityScope(identity), patientId, accessScope];
export const activeAccount = (identity: Identity) =>
  identity.stage === "ready" && !identity.historicalOnly;
export const activePatientScope = (scope: string) =>
  !["historical", "denied"].includes(scope);
export const consultationAllowed = (identity: Identity) =>
  activeAccount(identity) &&
  (identity.isManager ||
    identity.permissions.includes("appointments.manage") ||
    (identity.kind === "doctor" &&
      identity.permissions.includes("procedures.start") &&
      identity.permissions.includes("clinical.read")));
export const shareAllowed = (identity: Identity, doctorId: string) =>
  activeAccount(identity) &&
  (identity.isManager ||
    (identity.kind === "doctor" &&
      doctorId === identity.accountId &&
      identity.permissions.includes("billing.read")));
