import { useEffect } from "react";
import { z } from "zod";
import {
  reportDateSchema,
  type Identity,
  type AppointmentReport,
  type FinancialReport,
  type StockReport,
  type FollowUpList,
  type FollowUp,
  type ManualFollowUpShare,
} from "@clinic/contracts";
import { identityScope } from "../identity/identity.workflow.js";
import { useCareQuery } from "../clinical/useCareQuery.js";
import { reportAllowed, reportingKey } from "./reporting.access.js";
type Reads = {
  appointments: AppointmentReport;
  financial: FinancialReport;
  stock: StockReport;
  tasks: FollowUpList;
  history: { events: FollowUp[] };
  share: ManualFollowUpShare;
};
// Projections remain authoritative: no client totals, zero fallbacks or patient filtering.
export function useReport<K extends keyof Reads>(
  identity: Identity,
  view: K,
  date = "",
  taskId = "",
) {
  const root = reportingKey(identityScope(identity));
  const dated = view === "appointments" || view === "financial";
  const detail = view === "history" || view === "share";
  const valid =
    (!dated || reportDateSchema.safeParse({ date }).success) &&
    (!detail || z.uuid().safeParse(taskId).success);
  const allowed = reportAllowed(identity, view);
  const path = dated
    ? `reports/${view}?${new URLSearchParams({ date })}`
    : view === "stock"
      ? "reports/stock"
      : detail
        ? `follow-ups/${encodeURIComponent(taskId)}/${view}`
        : "follow-ups";
  const query = useCareQuery<Reads[K]>(
    [...root, view, dated ? date : detail ? taskId : ""],
    path,
    `reports/events?category=${view === "financial" ? "financial" : "operational"}`,
    allowed && valid,
    root,
  );
  // Stock expiry and current financial balances can change when the UTC day turns.
  useEffect(() => {
    if (!allowed || !valid || (view !== "stock" && view !== "financial"))
      return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      timer = setTimeout(
        () => {
          void query.refetch();
          schedule();
        },
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
        ) - now.getTime(),
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [allowed, valid, view, query.refetch]);
  return {
    ...query,
    data: allowed && valid ? query.data : undefined,
    denied: !allowed || query.denied,
    invalid: !valid,
    refetch: () =>
      allowed && valid ? query.refetch() : Promise.resolve(undefined),
  };
}
