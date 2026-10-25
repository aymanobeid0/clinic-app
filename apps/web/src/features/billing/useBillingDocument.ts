import type {
  Invoice,
  InvoiceOutput,
  PlanSummary,
  PlanSummaryOutput,
  Settlement,
} from "@clinic/contracts";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTreatmentRead } from "../treatment/useTreatmentRead.js";
import { treatmentGet } from "../treatment/treatment.api.js";
import { billingKey } from "./billing.actions.js";

type ReceiptOutput = {
  title: string;
  settlement: Settlement;
  labels: { newMoney: string; creditUsed: string; deposit: string };
};
export type BillingDocument =
  | { kind: "invoices" }
  | { kind: "invoice"; id: string }
  | { kind: "settlement"; id: string }
  | { kind: "summary"; planId: string };
type DocumentData =
  | Invoice[]
  | Invoice
  | Settlement
  | PlanSummary
  | InvoiceOutput
  | PlanSummaryOutput
  | ReceiptOutput;
// Every prepare/output invocation makes a new server-authorized request. Output
// never reuses a workspace/list snapshot or invents a document number.
export function useBillingDocument(
  accountKey: string,
  patientId: string,
  document: BillingDocument,
) {
  const cache = useQueryClient();
  const prefix = billingKey(accountKey, patientId);
  const path =
    `billing/${encodeURIComponent(patientId)}/` +
    (document.kind === "invoices"
      ? "invoices"
      : document.kind === "summary"
        ? `plans/${encodeURIComponent(document.planId)}/summary`
        : `${document.kind === "invoice" ? "invoices" : "settlements"}/${encodeURIComponent(document.id)}`);
  const read = useTreatmentRead<DocumentData>([...prefix, path], prefix);
  const scope = JSON.stringify([...prefix, path]);
  const clear = read.clear;
  useEffect(
    () =>
      cache.getQueryCache().subscribe((event) => {
        if (
          event.type === "updated" &&
          event.action.type === "invalidate" &&
          JSON.stringify(event.query.queryKey.slice(0, 4)) === scope
        ) {
          // Imperative readers cannot refetch on invalidation. Retire their preview
          // and require a new authorized read instead of showing stale balances.
          clear();
        }
      }),
    [cache, scope, clear],
  );
  const load = (target: string) =>
    read.read((signal) => treatmentGet<DocumentData>(target, signal));
  return {
    busy: read.busy,
    error: read.error,
    denied: read.denied,
    data: read.data,
    prepare: () => load(path),
    authorize: (action: "print" | "download") =>
      document.kind === "invoices"
        ? Promise.resolve(undefined)
        : load(`${path}/${action}`),
    clear: read.clear,
  };
}
