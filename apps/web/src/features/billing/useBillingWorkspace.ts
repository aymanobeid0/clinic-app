import type {
  BillingWorkspace,
  Identity,
  PaymentMethod,
} from "@clinic/contracts";
import { identityScope } from "../identity/identity.workflow.js";
import { useCareQuery } from "../clinical/useCareQuery.js";
import { billingKey } from "./billing.actions.js";

export function useBillingWorkspace(identity: Identity, patientId: string) {
  const key = billingKey(identityScope(identity), patientId);
  return useCareQuery<BillingWorkspace>(
    key,
    `billing/${encodeURIComponent(patientId)}`,
    identity.isManager || identity.permissions.includes("patients.read")
      ? "patients/events"
      : undefined,
    !!patientId && !identity.historicalOnly,
    key,
  );
}
export function usePaymentMethods(accountKey: string) {
  return useCareQuery<PaymentMethod[]>(
    billingKey(accountKey, "methods"),
    "billing/payment-methods",
  );
}
