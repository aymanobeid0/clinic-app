import type {
  BillingWorkspace,
  BillingAdjustment,
  OpeningBalance,
  ProcedureStart,
  Settlement,
  FinancialCorrection,
  TreatmentItem,
} from "@clinic/contracts";
import type { ClinicTransaction } from "../../database.js";
import { treatmentBilling } from "../treatment/index.js";
import { BillingRepository } from "./billing.repository.js";
import { projectFunds } from "./funds.js";
type Scope = {
  clinicId: string;
  accountId: string;
  ownWork: boolean;
  clinical: boolean;
};
const agreed = (item: TreatmentItem) =>
  BigInt(item.priceMinor) -
  BigInt(item.discountMinor) +
  (item.extras ?? []).reduce((n, e) => n + BigInt(e.amountMinor), 0n);
export async function projectBilling(
  tx: ClinicTransaction,
  c: Scope,
  patientId: string,
): Promise<BillingWorkspace> {
  const entries = await new BillingRepository(tx, c.clinicId).entries(
    patientId,
  );
  const allSettlements = entries
    .filter((e) => e.kind === "settlement")
    .map((e) => e.snapshot as unknown as Settlement);
  const corrections = entries
    .filter((e) => e.kind === "correction")
    .map((e) => e.snapshot as unknown as FinancialCorrection);
  const funds = projectFunds(allSettlements, corrections);
  const versions = await treatmentBilling(tx, c.clinicId).versions(patientId);
  const completions = await treatmentBilling(tx, c.clinicId).completions(
    patientId,
  );
  const latest = [...new Set(versions.map((v) => v.id))].map((id) =>
    versions.filter((v) => v.id === id).at(-1)!,
  );
  const charges = entries
    .filter(
      (e) =>
        e.kind === "charge" && (!c.ownWork || e.performedBy === c.accountId),
    )
    .map((e) => {
      const start = e.snapshot as unknown as ProcedureStart;
      const adjustments = entries
        .filter((a) => a.kind === "adjustment")
        .map((a) => a.snapshot as unknown as BillingAdjustment)
        .filter((a) => a.chargeId === e.id)
        .sort((a, b) => a.revision - b.revision);
      const current = latest.find((v) => v.id === start.planId);
      // Pending revisions cannot change debt or accepted price; use the most recent confirmed agreement.
      const accepted = versions
        .filter((v) => v.id === start.planId && v.acceptance)
        .at(-1);
      const item =
        accepted?.items.find((i) => i.id === start.itemId) ?? start.item;
      const due =
        BigInt(e.amountMinor.toFixed(0)) +
        adjustments.reduce((n, a) => n + BigInt(a.amountMinor), 0n);
      const allocations = funds.allocations
        .filter((a) => a.chargeId === e.id)
        .map(({ settlementId, at, newMoneyMinor, creditMinor }) => ({
          settlementId,
          at,
          newMoneyMinor,
          creditMinor,
        }));
      const paid = allocations.reduce(
        (n, a) => n + BigInt(a.newMoneyMinor) + BigInt(a.creditMinor),
        0n,
      );
      const acceptedMinor = agreed(item).toString();
      const lastAdjustment = adjustments.at(-1);
      const adjustmentAgreement = versions.find(
        (v) =>
          v.id === start.planId &&
          v.revision === lastAdjustment?.acceptedRevision,
      )?.acceptance;
      return {
        id: e.id,
        planId: start.planId,
        itemId: start.itemId,
        currency: e.currency,
        performedBy: start.performedBy,
        completedAt:
          completions.find(
            (v) => v.planId === start.planId && v.itemId === start.itemId,
          )?.at ?? null,
        originalMinor: e.amountMinor.toFixed(0),
        dueMinor: (due - paid).toString(),
        chargedMinor: due.toString(),
        paidMinor: paid.toString(),
        allocations,
        acceptedMinor,
        revision: adjustments.length,
        reconciliationRequired:
          current?.status !== "cancelled" &&
          !(
            lastAdjustment?.correctionId &&
            adjustmentAgreement &&
            adjustmentAgreement.proposalRevision ===
              accepted?.acceptance?.proposalRevision
          ) &&
          acceptedMinor !== due.toString(),
        adjustments,
        at: start.at,
        ...(c.clinical
          ? { name: start.item.name, teeth: start.item.teeth }
          : {}),
      };
    });
  const planned: BillingWorkspace["planned"] = c.ownWork
    ? []
    : latest
        .filter(
          (p) => p.acceptance && ["accepted", "in_progress"].includes(p.status),
        )
        .flatMap((p) =>
          p.items
            .filter(
              (i) =>
                !entries.some(
                  (e) =>
                    e.kind === "charge" &&
                    (e.snapshot as unknown as ProcedureStart).planId === p.id &&
                    (e.snapshot as unknown as ProcedureStart).itemId === i.id,
                ),
            )
            .map((i) => ({
              planId: p.id,
              itemId: i.id,
              currency: p.currency,
              amountMinor: agreed(i).toString(),
              ...(c.clinical ? { name: i.name, teeth: i.teeth } : {}),
            })),
        );
  const openingBalances = c.ownWork
    ? []
    : entries
        .filter((e) => e.kind === "opening")
        .map((e) => e.snapshot as unknown as OpeningBalance);
  const currencies = [
    ...new Set(
      [
        ...charges,
        ...planned,
        ...openingBalances,
        ...(!c.ownWork ? allSettlements : []),
      ].map((e) => e.currency),
    ),
  ].sort();
  const totals = currencies.map((currency) => ({
    currency,
    plannedMinor: planned
      .filter((e) => e.currency === currency)
      .reduce((n, e) => n + BigInt(e.amountMinor), 0n)
      .toString(),
    dueMinor: (
      charges
        .filter((e) => e.currency === currency)
        .reduce((n, e) => n + BigInt(e.dueMinor), 0n) +
      openingBalances
        .filter((e) => e.currency === currency)
        .reduce((n, e) => n + BigInt(e.amountMinor), 0n)
    ).toString(),
    creditMinor: funds.lots
      .filter(
        (l) =>
          l.currency === currency &&
          (!c.ownWork || l.performedBy === c.accountId),
      )
      .reduce((n, l) => n + BigInt(l.availableMinor), 0n)
      .toString(),
  }));
  const settlements = c.ownWork
    ? allSettlements.filter(
        (s) =>
          s.depositMinor === "0" &&
          s.allocations.length > 0 &&
          s.allocations.every((a) =>
            charges.some((ch) => ch.id === a.chargeId),
          ),
      )
    : allSettlements;
  const visibleInvoiceIds = (
    await new BillingRepository(tx, c.clinicId).invoices(patientId)
  )
    .filter(
      (i) =>
        !c.ownWork || i.items.every((it) => it.performedBy === c.accountId),
    )
    .map((i) => i.id);
  return {
    patientId,
    corrections: corrections
      .filter(
        (v) =>
          !c.ownWork ||
          (v.chargeIds.length > 0 &&
            v.chargeIds.every((id) => charges.some((ch) => ch.id === id)) &&
            v.credits.every((l) => l.performedBy === c.accountId) &&
            (!v.sourceId ||
              funds.lots.some(
                (l) => l.id === v.sourceId && l.performedBy === c.accountId,
              ))),
      )
      .map((v) => ({
        ...v,
        invoiceIds: v.invoiceIds.filter((id) => visibleInvoiceIds.includes(id)),
      })),
    creditSources: funds.lots.filter(
      (l) => !c.ownWork || l.performedBy === c.accountId,
    ),
    charges,
    planned,
    openingBalances,
    totals,
    settlements,
    deposits: c.ownWork
      ? []
      : funds.lots
          .filter((l) => allSettlements.some((s) => s.id === l.id))
          .map((l) => ({
            settlementId: l.id,
            currency: l.currency,
            amountMinor: l.amountMinor,
            availableMinor: l.availableMinor,
          })),
  };
}
