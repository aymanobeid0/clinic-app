import type { ClinicTransaction } from "../../database.js";
import { BillingRepository } from "./billing.repository.js";
import { projectBilling } from "./billing.projection.js";
import type { FinancialCorrection } from "@clinic/contracts";
// Reporting uses billing's authoritative reconciliation; never infers debt from invoices.
export async function reportPatientBilling(
  tx: ClinicTransaction,
  c: {
    clinicId: string;
    accountId: string;
    ownWork: boolean;
    clinical: boolean;
  },
  patientId: string,
  date: string,
) {
  const state = await projectBilling(tx, c, patientId);
  const repository = new BillingRepository(tx, c.clinicId);
  const entries = await repository.entries(patientId);
  const settlements = entries
    .filter((e) => e.kind === "settlement")
    .map(
      (e) => e.snapshot as unknown as import("@clinic/contracts").Settlement,
    );
  const invoices = (await repository.invoices(patientId)).filter(
    (i) => !c.ownWork || i.items.every((it) => it.performedBy === c.accountId),
  );
  // Mixed corrections can be hidden as documents while their attributable
  // amounts still belong in a doctor's report. Never expose their raw history.
  const reportCorrections = entries
    .filter((e) => e.kind === "correction")
    .map((e) => e.snapshot as unknown as FinancialCorrection);
  const onDay = (at: string) => at.slice(0, 10) === date;
  const sum = (values: string[]) =>
    values.reduce((n, v) => n + BigInt(v), 0n).toString();
  const totals = state.totals.map((t) => {
    const payments = settlements.filter(
      (s) => s.currency === t.currency && onDay(s.at),
    );
    const corrections = reportCorrections.filter(
      (v) => v.currency === t.currency && onDay(v.at),
    );
    const ownAllocations = payments.flatMap((s) =>
      s.allocations.filter((a) =>
        state.charges.some((ch) => ch.id === a.chargeId),
      ),
    );
    const reversed = new Set(
      corrections
        .filter((v) => v.kind === "reversal")
        .map((v) => v.reversedSettlementId),
    );
    return {
      currency: t.currency,
      dueMinor: t.dueMinor,
      creditMinor: t.creditMinor,
      plannedMinor: t.plannedMinor,
      newMoneyMinor: sum(
        c.ownWork
          ? ownAllocations.map((a) => a.newMoneyMinor)
          : payments.map((s) => s.newMoneyMinor),
      ),
      appliedCreditMinor: sum(
        c.ownWork
          ? ownAllocations.map((a) => a.creditMinor)
          : payments.flatMap((s) => s.allocations.map((a) => a.creditMinor)),
      ),
      openingMinor: sum(
        state.openingBalances
          .filter((v) => v.currency === t.currency && onDay(v.at))
          .map((v) => v.amountMinor),
      ),
      adjustmentMinor: sum(
        state.charges
          .filter((ch) => ch.currency === t.currency)
          .flatMap((ch) =>
            ch.adjustments.filter((a) => onDay(a.at)).map((a) => a.amountMinor),
          ),
      ),
      refundMinor: sum(
        corrections
          .filter(
            (v) =>
              v.kind === "refund" &&
              (!c.ownWork ||
                state.creditSources.some(
                  (source) =>
                    source.id === v.sourceId &&
                    source.performedBy === c.accountId,
                )),
          )
          .map((v) => v.amountMinor ?? "0"),
      ),
      reversedMoneyMinor: sum(
        settlements
          .filter((s) => s.currency === t.currency && reversed.has(s.id))
          .map((s) =>
            c.ownWork
              ? sum(
                  s.allocations
                    .filter((a) =>
                      state.charges.some((ch) => ch.id === a.chargeId),
                    )
                    .map((a) => a.newMoneyMinor),
                )
              : s.newMoneyMinor,
          ),
      ),
      invoiceMinor: sum(
        invoices
          .filter((i) => i.currency === t.currency && onDay(i.at))
          .map((i) => i.totalMinor),
      ),
    };
  });
  const payments = settlements
    .filter((s) => onDay(s.at))
    .flatMap((s) => {
      const allocations = s.allocations.filter((a) =>
        state.charges.some((ch) => ch.id === a.chargeId),
      );
      if (c.ownWork && !allocations.length) return [];
      return [
        {
          id: s.id,
          receiptNumber: s.receiptNumber,
          currency: s.currency,
          at: s.at,
          newMoneyMinor: c.ownWork
            ? sum(allocations.map((a) => a.newMoneyMinor))
            : s.newMoneyMinor,
          appliedCreditMinor: sum(
            (c.ownWork ? allocations : s.allocations).map((a) => a.creditMinor),
          ),
        },
      ];
    });
  return {
    totals,
    payments,
    invoices: invoices
      .filter((i) => onDay(i.at))
      .map(({ id, number, currency, at, totalMinor }) => ({
        id,
        number,
        currency,
        at,
        totalMinor,
      })),
  };
}
