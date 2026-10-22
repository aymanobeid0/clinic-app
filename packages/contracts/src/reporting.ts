import { z } from "zod";
import type { Appointment } from "./index.js";
import type { InventoryProjection } from "./inventory.js";
export type AppointmentReport = { date: string; appointments: Appointment[] };
export type StockReport = {
  asOfDate: string;
  settings: InventoryProjection["settings"];
  lowStock: InventoryProjection["items"];
  expiring: InventoryProjection["batches"];
  expired: InventoryProjection["batches"];
};
export const reportDateSchema = z.object({ date: z.iso.date() }).strict();
export type FinancialReportTotal = {
  currency: string;
  newMoneyMinor: string;
  appliedCreditMinor: string;
  openingMinor: string;
  adjustmentMinor: string;
  refundMinor: string;
  reversedMoneyMinor: string;
  invoiceMinor: string;
  dueMinor: string;
  creditMinor: string;
  plannedMinor: string;
};
export type FinancialReport = {
  date: string;
  balanceAsOf: string;
  totals: FinancialReportTotal[];
  patients: {
    patientId: string;
    patientNumber: number;
    name: string;
    totals: FinancialReportTotal[];
    payments: {
      id: string;
      receiptNumber: string | null;
      currency: string;
      at: string;
      newMoneyMinor: string;
      appliedCreditMinor: string;
    }[];
    invoices: {
      id: string;
      number: string;
      currency: string;
      at: string;
      totalMinor: string;
    }[];
  }[];
};

const id = z.uuid().transform((v) => v.toLowerCase());
export const createFollowUpSchema = z
  .object({ commandId: id, patientId: id, dueOn: z.iso.date() })
  .strict();
export const updateFollowUpSchema = z
  .object({
    commandId: id,
    revision: z.number().int().positive(),
    status: z.enum(["open", "completed"]),
    dueOn: z.iso.date().optional(),
  })
  .strict();
export type FollowUp = {
  id: string;
  patientId: string;
  kind: "contact_patient";
  dueOn: string;
  status: "open" | "completed";
  revision: number;
  actorId: string;
  at: string;
};
export type PendingNoteTask = {
  id: string;
  patientId: string;
  visitId: string;
  kind: "pending_note";
  status: "open";
};
export type FollowUpList = {
  tasks: FollowUp[];
  pendingNotes: PendingNoteTask[];
};
export type ManualFollowUpShare = { delivery: "manual"; text: string };
