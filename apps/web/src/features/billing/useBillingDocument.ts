import type {
  Invoice,
  InvoiceOutput,
  PlanSummary,
  PlanSummaryOutput,
  Settlement,
} from "@clinic/contracts";
import { useTreatmentRead } from "../treatment/useTreatmentRead.js";
import { useQueryClient } from "@tanstack/react-query";
import { treatmentRead } from "../treatment/treatment.workflow.js";
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
  const read = useTreatmentRead<DocumentData>([...prefix, path]);
  const load = (target: string) =>
    read.read((signal) =>
      treatmentRead(
        cache,
        prefix,
        () => treatmentGet<DocumentData>(target, signal),
        signal,
      ),
    );
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
