import type { Identity } from "@clinic/contracts";
export const reportingKey = (account: string) => ["reporting", account];
export function operationalAllowed(identity: Identity) {
  return identity.stage === "ready" && !identity.historicalOnly;
}
export function reportAllowed(identity: Identity, view: string) {
  if (!operationalAllowed(identity)) return false;
  if (view === "financial")
    return (
      identity.isManager ||
      (identity.permissions.includes("reports.financial") &&
        identity.permissions.includes("billing.read"))
    );
  return (
    identity.permissions.includes("reports.operational") &&
    (view !== "stock" || identity.permissions.includes("inventory.read"))
  );
}
