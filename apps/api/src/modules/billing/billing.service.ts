import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type {
  BillingWorkspace,
  BillingAdjustment,
  OpeningBalance,
  ProcedureStart,
  TreatmentItem,
  openingBalanceSchema,
  reconcileChargeSchema,
} from "@clinic/contracts";
import {
  IdentityError,
  type Actor,
  type IdentityAccess,
} from "../identity/index.js";
import { treatmentBilling, exactMinor } from "../treatment/index.js";
import type { ClinicTransaction } from "../../database.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { BillingRepository } from "./billing.repository.js";

const agreed = (item: TreatmentItem) =>
  BigInt(item.priceMinor) -
  BigInt(item.discountMinor) +
  (item.extras ?? []).reduce((n, e) => n + BigInt(e.amountMinor), 0n);
type Scope = {
  clinicId: string;
  accountId: string;
  ownWork: boolean;
  clinical: boolean;
};

export class BillingService {
  constructor(
    readonly identity: IdentityAccess,
    readonly updates: ClinicUpdates,
    readonly now: () => number,
  ) {}
  state(actor: Actor | undefined, patientId: string) {
    return this.identity.withFinancialPermission(
      actor,
      patientId,
      "billing.read",
      async (c, tx) => {
        await treatmentBilling(tx, c.clinicId).lock();
        return this.project(tx, c, patientId);
      },
    );
  }
  private async project(
    tx: ClinicTransaction,
    c: Scope,
    patientId: string,
  ): Promise<BillingWorkspace> {
    const entries = await new BillingRepository(tx, c.clinicId).entries(
      patientId,
    );
    const versions = await treatmentBilling(tx, c.clinicId).versions(patientId);
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
          e.amountMinor +
          adjustments.reduce((n, a) => n + BigInt(a.amountMinor), 0n);
        const acceptedMinor = agreed(item).toString();
        return {
          id: e.id,
          planId: start.planId,
          itemId: start.itemId,
          currency: e.currency,
          performedBy: start.performedBy,
          originalMinor: e.amountMinor.toString(),
          dueMinor: due.toString(),
          acceptedMinor,
          revision: adjustments.length,
          reconciliationRequired:
            current?.status !== "cancelled" && acceptedMinor !== due.toString(),
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
            (p) =>
              p.acceptance && ["accepted", "in_progress"].includes(p.status),
          )
          .flatMap((p) =>
            p.items
              .filter(
                (i) =>
                  !entries.some(
                    (e) =>
                      e.kind === "charge" &&
                      (e.snapshot as unknown as ProcedureStart).planId ===
                        p.id &&
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
        [...charges, ...planned, ...openingBalances].map((e) => e.currency),
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
      creditMinor: "0",
    }));
    return { patientId, charges, planned, openingBalances, totals };
  }
  async opening(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof openingBalanceSchema>,
  ) {
    const result = await this.identity.withFinancialPermission(
      actor,
      patientId,
      "billing.edit",
      async (c, tx) => {
        if (c.ownWork)
          throw new IdentityError(
            403,
            "Un solde non attribué nécessite une autorité financière générale.",
          );
        const plans = treatmentBilling(tx, c.clinicId),
          r = new BillingRepository(tx, c.clinicId);
        await plans.lock();
        const replay = await r.replay(data.commandId, c.accountId, [
          "opening",
          patientId,
          data,
        ]);
        if (replay.receipt)
          return { clinicId: c.clinicId, value: replay.receipt };
        const currency = await plans.currency(data.currency);
        if (!currency) throw new IdentityError(400, "Devise non activée.");
        if (Date.parse(data.asOf) > this.now())
          throw new IdentityError(400, "Date future interdite.");
        const amount = exactMinor(data.amount, currency.precision);
        if (amount <= 0n) throw new IdentityError(400, "Solde positif requis.");
        const value: OpeningBalance = {
          id: data.id,
          currency: data.currency,
          amountMinor: amount.toString(),
          provenance: data.provenance,
          asOf: data.asOf,
          actorId: c.accountId,
          at: new Date(this.now()).toISOString(),
        };
        await r.opening(patientId, value);
        await r.save(data.commandId, c.accountId, replay.hash, value);
        return { clinicId: c.clinicId, value };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
  async reconcile(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof reconcileChargeSchema>,
  ) {
    const result = await this.identity.withFinancialPermission(
      actor,
      patientId,
      "billing.edit",
      async (c, tx) => {
        const plans = treatmentBilling(tx, c.clinicId),
          r = new BillingRepository(tx, c.clinicId);
        await plans.lock();
        const state = await this.project(tx, c, patientId);
        const charge = state.charges.find((e) => e.id === data.chargeId);
        if (!charge) throw new IdentityError(404, "Charge introuvable.");
        const replay = await r.replay(data.commandId, c.accountId, [
          "reconcile",
          patientId,
          data,
        ]);
        if (replay.receipt)
          return { clinicId: c.clinicId, value: replay.receipt };
        const versions = await plans.versions(patientId, charge.planId),
          plan = versions.at(-1);
        if (
          !plan?.acceptance ||
          !["accepted", "in_progress", "completed"].includes(plan.status) ||
          plan.revision !== data.acceptedRevision ||
          charge.revision !== data.revision
        )
          throw new IdentityError(
            409,
            "Relisez la charge et la version acceptée.",
          );
        const item = plan.items.find((i) => i.id === charge.itemId);
        if (!item) throw new IdentityError(409, "Acte accepté introuvable.");
        const target = agreed(item),
          delta = target - BigInt(charge.dueMinor);
        if (delta === 0n)
          throw new IdentityError(409, "Charge déjà réconciliée.");
        const value: BillingAdjustment = {
          id: randomUUID(),
          chargeId: charge.id,
          revision: charge.revision + 1,
          acceptedRevision: plan.revision,
          amountMinor: delta.toString(),
          targetMinor: target.toString(),
          reason: data.reason,
          actorId: c.accountId,
          at: new Date(this.now()).toISOString(),
        };
        await r.adjust(patientId, charge.currency, charge.performedBy, value);
        await r.save(data.commandId, c.accountId, replay.hash, value);
        return { clinicId: c.clinicId, value };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
}
