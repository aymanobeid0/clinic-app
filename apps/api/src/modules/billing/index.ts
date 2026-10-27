import type { ProcedureStart } from "@clinic/contracts";
import type { ClinicTransaction } from "../../database.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import type { IdentityAccess } from "../identity/index.js";
import { BillingRepository } from "./billing.repository.js";
import { BillingService } from "./billing.service.js";
import { BillingController } from "./billing.controller.js";
import { billingRoutes } from "./billing.routes.js";
import { projectFunds } from "./funds.js";
import type {
  Settlement,
  FinancialCorrection,
  ConsultationCharge,
} from "@clinic/contracts";
export async function consultationFunds(
  tx: ClinicTransaction,
  clinicId: string,
  patientId: string,
  id: string,
  currency: string,
  rate: string | null,
) {
  const entries = await new BillingRepository(tx, clinicId).entries(patientId);
  const settlements = entries
    .filter((e) => e.kind === "settlement")
    .map((e) => e.snapshot as unknown as Settlement);
  const corrections = entries
    .filter((e) => e.kind === "correction")
    .map((e) => e.snapshot as unknown as FinancialCorrection);
  const chargeIds = new Set([
    id,
    ...entries
      .filter((e) => e.kind === "charge")
      .map((e) => e.snapshot as unknown as ConsultationCharge)
      .filter((e) => e.sourceKind === "consultation" && e.consultationId === id)
      .map((e) => e.id),
  ]);
  const funds = projectFunds(settlements, corrections);
  const base = funds.allocations
    .filter((a) => chargeIds.has(a.chargeId))
    .reduce((n, a) => n + BigInt(a.newMoneyMinor) + BigInt(a.creditMinor), 0n);
  const digits = rate?.split(".")[1]?.length ?? 0;
  return {
    consultationId: id,
    currency,
    settlementIds: settlements
      .filter((s) => s.consultation?.consultationId === id)
      .map((s) => s.id),
    recognizedBaseMinor: base.toString(),
    shareNumerator: (base * BigInt((rate ?? "0").replace(".", ""))).toString(),
    shareDenominator: (100n * 10n ** BigInt(digits)).toString(),
  };
}
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
export async function createConsultationCharge(
  tx: ClinicTransaction,
  clinicId: string,
  event: import("@clinic/contracts").ConsultationCharge,
) {
  await new BillingRepository(tx, clinicId).consultationCharge(event);
}
export { projectBilling as captureBilling } from "./billing.projection.js";
export async function captureOwnInvoices(
  tx: ClinicTransaction,
  clinicId: string,
  patientId: string,
  accountId: string,
) {
  return (await new BillingRepository(tx, clinicId).invoices(patientId)).filter(
    (v) =>
      v.items.length > 0 && v.items.every((i) => i.performedBy === accountId),
  );
}

export { reportPatientBilling } from "./billing.report.js";
export async function exportBilling(
  tx: ClinicTransaction,
  c: {
    clinicId: string;
    accountId: string;
    ownWork: boolean;
    clinical: boolean;
  },
  patientId: string,
) {
  const { projectBilling } = await import("./billing.projection.js");
  const state = await projectBilling(tx, c, patientId);
  const invoices = (
    await new BillingRepository(tx, c.clinicId).invoices(patientId)
  ).filter(
    (i) => !c.ownWork || i.items.every((it) => it.performedBy === c.accountId),
  );
  return {
    ...state,
    invoices: invoices.map((i) => ({
      ...i,
      items: i.items.map(({ name, teeth, ...item }) => ({
        ...item,
        ...(c.clinical ? { name, teeth } : {}),
      })),
    })),
  };
}
export { assertExportBound as boundBillingExport } from "./export-bounds.repository.js";
