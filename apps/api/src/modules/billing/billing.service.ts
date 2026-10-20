import { AppError } from "../../errors/app-error.js";
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
  paymentMethodSchema,
  settlementSchema,
  PaymentMethod,
  Settlement,
  Invoice,
  PlanSummary,
  issueInvoiceSchema,
} from "@clinic/contracts";
import type { Actor, IdentityAccess } from "../identity/index.js";
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
  private visibleInvoice(invoice: Invoice, c: Scope) {
    if (c.ownWork && invoice.items.some((i) => i.performedBy !== c.accountId))
      return null;
    return {
      ...invoice,
      items: invoice.items.map(({ name, teeth, ...item }) => ({
        ...item,
        ...(c.clinical ? { name, teeth } : {}),
      })),
    };
  }
  invoices(
    actor: Actor | undefined,
    patientId: string,
    id?: string,
    action?: "print" | "download",
  ) {
    return this.identity.withFinancialPermission(
      actor,
      patientId,
      action ? `financial.${action}` : "billing.read",
      async (c, tx) => {
        const values = (
          await new BillingRepository(tx, c.clinicId).invoices(patientId)
        ).flatMap((v) => {
          const visible = this.visibleInvoice(v, c);
          return visible ? [visible] : [];
        });
        if (!id) return values;
        const invoice = values.find((v) => v.id === id);
        if (!invoice) throw new AppError(404, "Facture introuvable.");
        return action ? { title: "Facture", invoice } : invoice;
      },
    );
  }
  async issue(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof issueInvoiceSchema>,
  ) {
    const result = await this.identity.withFinancialPermission(
      actor,
      patientId,
      "invoices.issue",
      async (c, tx) => {
        const plans = treatmentBilling(tx, c.clinicId),
          r = new BillingRepository(tx, c.clinicId);
        await plans.lock();
        const replay = await r.replay(data.commandId, c.accountId, [
          "invoice",
          patientId,
          data,
        ]);
        if (replay.receipt) {
          const value = this.visibleInvoice(
            replay.receipt as unknown as Invoice,
            c,
          );
          if (!value)
            throw new AppError(403, "Périmètre financier non autorisé.");
          return { clinicId: c.clinicId, value };
        }
        if (new Set(data.chargeIds).size !== data.chargeIds.length)
          throw new AppError(400, "Charge répétée.");
        const state = await this.project(tx, c, patientId),
          completions = await plans.completions(patientId);
        const issued = await r.invoices(patientId);
        const items: Invoice["items"] = data.chargeIds.map((id) => {
          const charge = state.charges.find((ch) => ch.id === id);
          if (!charge) throw new AppError(404, "Charge introuvable.");
          const completion = completions.find(
            (v) => v.planId === charge.planId && v.itemId === charge.itemId,
          );
          if (
            !completion ||
            charge.dueMinor !== "0" ||
            charge.reconciliationRequired
          )
            throw new AppError(
              409,
              "Acte terminé, réconcilié et intégralement payé requis.",
            );
          if (issued.some((v) => v.items.some((i) => i.chargeId === id)))
            throw new AppError(409, "Charge déjà facturée.");
          return {
            chargeId: id,
            planId: charge.planId,
            itemId: charge.itemId,
            performedBy: charge.performedBy,
            amountMinor: charge.chargedMinor,
            completedAt: completion.at,
            ...(charge.name !== undefined
              ? { name: charge.name, teeth: charge.teeth }
              : {}),
          };
        });
        const currencies = new Set(
          state.charges
            .filter((ch) => data.chargeIds.includes(ch.id))
            .map((ch) => ch.currency),
        );
        if (currencies.size !== 1)
          throw new AppError(400, "Une seule devise par facture.");
        // Retain full financial content regardless of issuer; redact only at delivery.
        const full = await this.project(
          tx,
          { ...c, clinical: true },
          patientId,
        );
        for (const item of items) {
          const charge = full.charges.find((ch) => ch.id === item.chargeId)!;
          item.name = charge.name;
          item.teeth = charge.teeth;
        }
        const at = new Date(this.now()).toISOString();
        const invoice: Invoice = {
          id: randomUUID(),
          patientId,
          number: await r.nextInvoice(new Date(at).getUTCFullYear()),
          currency: [...currencies][0]!,
          actorId: c.accountId,
          at,
          identity: await r.documentIdentity(patientId),
          items,
          totalMinor: items
            .reduce((n, i) => n + BigInt(i.amountMinor), 0n)
            .toString(),
        };
        await r.invoice(invoice);
        await r.save(data.commandId, c.accountId, replay.hash, invoice);
        return {
          clinicId: c.clinicId,
          value: this.visibleInvoice(invoice, c)!,
        };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
  summary(
    actor: Actor | undefined,
    patientId: string,
    planId: string,
    action?: "print" | "download",
  ) {
    return this.identity.withFinancialPermission(
      actor,
      patientId,
      action ? `financial.${action}` : "billing.read",
      async (c, tx) => {
        const plans = treatmentBilling(tx, c.clinicId),
          r = new BillingRepository(tx, c.clinicId);
        await plans.lock();
        const plan = (await plans.versions(patientId, planId)).at(-1);
        const state = await this.project(tx, c, patientId);
        const charges = state.charges.filter((ch) => ch.planId === planId);
        if (!plan || (c.ownWork && !charges.length))
          throw new AppError(404, "Plan introuvable.");
        if (plan.status !== "completed")
          throw new AppError(409, "Plan terminé requis.");
        const completions = await plans.completions(patientId);
        const invoices = (await r.invoices(patientId)).flatMap((v) => {
          const visible = this.visibleInvoice(v, c);
          return visible ? [visible] : [];
        });
        const summary: PlanSummary = {
          patientId,
          planId,
          planRevision: plan.revision,
          currency: plan.currency,
          identity: await r.documentIdentity(patientId),
          scope: c.ownWork ? "own_work" : "whole_plan",
          ...(c.clinical ? { title: plan.title } : {}),
          procedures: charges.map((ch) => {
            const invoice = invoices.find((v) =>
              v.items.some((i) => i.chargeId === ch.id),
            );
            const completion = completions.find(
              (v) => v.planId === planId && v.itemId === ch.itemId,
            );
            if (!completion) throw new AppError(409, "Acte terminé requis.");
            return {
              chargeId: ch.id,
              itemId: ch.itemId,
              performedBy: ch.performedBy,
              completedAt: completion.at,
              chargedMinor: ch.chargedMinor,
              paidMinor: ch.paidMinor,
              dueMinor: ch.dueMinor,
              ...(ch.name !== undefined
                ? { name: ch.name, teeth: ch.teeth }
                : {}),
              invoice: invoice
                ? { id: invoice.id, number: invoice.number }
                : null,
              payments: ch.allocations.map((a) => ({
                settlementId: a.settlementId,
                receiptNumber:
                  state.settlements.find((s) => s.id === a.settlementId)
                    ?.receiptNumber ?? null,
                amountMinor: (
                  BigInt(a.newMoneyMinor) + BigInt(a.creditMinor)
                ).toString(),
              })),
            };
          }),
          chargedMinor: charges
            .reduce((n, ch) => n + BigInt(ch.chargedMinor), 0n)
            .toString(),
          paidMinor: charges
            .reduce((n, ch) => n + BigInt(ch.paidMinor), 0n)
            .toString(),
          dueMinor: charges
            .reduce((n, ch) => n + BigInt(ch.dueMinor), 0n)
            .toString(),
        };
        return action
          ? { title: "Récapitulatif du plan terminé", summary }
          : summary;
      },
    );
  }
  methods(actor: Actor | undefined) {
    return this.identity.withPermissionOrManager(
      actor,
      "billing.edit",
      async (c, tx) => new BillingRepository(tx, c.clinicId).methods(),
    );
  }
  async method(
    actor: Actor | undefined,
    data: z.infer<typeof paymentMethodSchema>,
  ) {
    const result = await this.identity.withManager(actor, async (c, tx) => {
      await treatmentBilling(tx, c.clinicId).lock();
      const r = new BillingRepository(tx, c.clinicId);
      const replay = await r.replay(data.commandId, c.accountId, [
        "method",
        data,
      ]);
      if (replay.receipt)
        return { clinicId: c.clinicId, value: replay.receipt };
      const current = (await r.methods()).find((m) => m.id === data.id);
      if ((current?.revision ?? 0) !== data.revision)
        throw new AppError(409, "Relisez le moyen de paiement.");
      const value: PaymentMethod = {
        id: data.id,
        revision: data.revision + 1,
        name: data.name,
        active: data.active,
      };
      await r.method(value);
      await r.save(data.commandId, c.accountId, replay.hash, value);
      return { clinicId: c.clinicId, value };
    });
    this.updates.publish(result.clinicId);
    return result.value;
  }
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
  async settlement(actor: Actor | undefined, patientId: string, id: string) {
    const state = await this.state(actor, patientId);
    const value = state.settlements.find((s) => s.id === id);
    if (!value) throw new AppError(404, "Règlement introuvable.");
    return value;
  }
  output(
    actor: Actor | undefined,
    patientId: string,
    id: string,
    action: "print" | "download",
  ) {
    return this.identity.withFinancialPermission(
      actor,
      patientId,
      `financial.${action}`,
      async (c, tx) => {
        await treatmentBilling(tx, c.clinicId).lock();
        const state = await this.project(tx, c, patientId);
        const settlement = state.settlements.find((s) => s.id === id);
        if (!settlement) throw new AppError(404, "Règlement introuvable.");
        return {
          title: settlement.receiptNumber ? "Reçu" : "Affectation de crédit",
          settlement,
          labels: {
            newMoney: "Nouveaux fonds reçus",
            creditUsed: "Crédit antérieurement reçu utilisé",
            deposit: "Dépôt distinct",
          },
        };
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
    const allSettlements = entries
      .filter((e) => e.kind === "settlement")
      .map((e) => e.snapshot as unknown as Settlement);
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
          BigInt(e.amountMinor.toFixed(0)) +
          adjustments.reduce((n, a) => n + BigInt(a.amountMinor), 0n);
        const allocations = allSettlements.flatMap((s) =>
          s.allocations
            .filter((a) => a.chargeId === e.id)
            .map((a) => ({
              settlementId: s.id,
              at: s.at,
              newMoneyMinor: a.newMoneyMinor,
              creditMinor: a.creditMinor,
            })),
        );
        const paid = allocations.reduce(
          (n, a) => n + BigInt(a.newMoneyMinor) + BigInt(a.creditMinor),
          0n,
        );
        const acceptedMinor = agreed(item).toString();
        return {
          id: e.id,
          planId: start.planId,
          itemId: start.itemId,
          currency: e.currency,
          performedBy: start.performedBy,
          originalMinor: e.amountMinor.toFixed(0),
          dueMinor: (due - paid).toString(),
          chargedMinor: due.toString(),
          paidMinor: paid.toString(),
          allocations,
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
      creditMinor: c.ownWork
        ? "0"
        : allSettlements
            .filter((s) => s.currency === currency)
            .reduce(
              (n, s) => n + BigInt(s.depositMinor) - BigInt(s.creditUsedMinor),
              0n,
            )
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
    return {
      patientId,
      charges,
      planned,
      openingBalances,
      totals,
      settlements,
      deposits: c.ownWork
        ? []
        : allSettlements
            .filter((s) => BigInt(s.depositMinor) > 0n)
            .map((s) => ({
              settlementId: s.id,
              currency: s.currency,
              amountMinor: s.depositMinor,
              availableMinor: (
                BigInt(s.depositMinor) -
                allSettlements
                  .flatMap((v) => v.allocations)
                  .flatMap((a) => a.sources)
                  .filter((src) => src.settlementId === s.id)
                  .reduce((n, src) => n + BigInt(src.amountMinor), 0n)
              ).toString(),
            })),
    };
  }
  async settle(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof settlementSchema>,
  ) {
    const result = await this.identity.withFinancialPermission(
      actor,
      patientId,
      "billing.edit",
      async (c, tx) => {
        const plans = treatmentBilling(tx, c.clinicId),
          r = new BillingRepository(tx, c.clinicId);
        await plans.lock();
        const replay = await r.replay(data.commandId, c.accountId, [
          "settle",
          patientId,
          data,
        ]);
        // Re-authorize replay against the current financial scope, not just the stored command actor.
        const state = await this.project(tx, c, patientId);
        if (replay.receipt) {
          const prior = replay.receipt as unknown as Settlement;
          if (
            c.ownWork &&
            (prior.depositMinor !== "0" ||
              prior.allocations.some(
                (a) => !state.charges.some((ch) => ch.id === a.chargeId),
              ))
          )
            throw new AppError(403, "Périmètre financier non autorisé.");
          return { clinicId: c.clinicId, value: replay.receipt };
        }
        const currency = await plans.currency(data.currency);
        if (!currency) throw new AppError(400, "Devise non activée.");
        const money = exactMinor(data.newMoney, currency.precision),
          deposit = exactMinor(data.deposit, currency.precision);
        const method = (await r.methods()).find(
          (m) => m.id === data.methodId && m.active,
        );
        if ((money > 0n && !method) || (money === 0n && data.methodId !== null))
          throw new AppError(
            400,
            "Moyen de paiement actif requis uniquement pour les nouveaux fonds.",
          );
        if (
          new Set(data.allocations.map((a) => a.chargeId)).size !==
          data.allocations.length
        )
          throw new AppError(400, "Charge répétée.");
        const allocations: Settlement["allocations"] = data.allocations.map(
          (a) => {
            const charge = state.charges.find((ch) => ch.id === a.chargeId);
            if (!charge) throw new AppError(404, "Charge introuvable.");
            if (charge.currency !== data.currency)
              throw new AppError(400, "Devise différente.");
            const fresh = exactMinor(a.newMoney, currency.precision),
              credit = exactMinor(a.credit, currency.precision);
            if (
              fresh + credit <= 0n ||
              fresh + credit > BigInt(charge.dueMinor)
            )
              throw new AppError(
                409,
                "Montant supérieur au solde ou allocation vide.",
              );
            return {
              chargeId: a.chargeId,
              newMoneyMinor: fresh.toString(),
              creditMinor: credit.toString(),
              sources: [],
            };
          },
        );
        const newAllocated = allocations.reduce(
          (n, a) => n + BigInt(a.newMoneyMinor),
          0n,
        );
        const creditUsed = allocations.reduce(
          (n, a) => n + BigInt(a.creditMinor),
          0n,
        );
        if (money !== newAllocated + deposit || money + creditUsed === 0n)
          throw new AppError(
            400,
            "Rapprochez les nouveaux fonds, allocations et dépôt explicite.",
          );
        if (c.ownWork && (deposit > 0n || creditUsed > 0n))
          throw new AppError(
            403,
            "Le crédit non attribué nécessite une autorité financière générale.",
          );
        const available = state.settlements
          .filter((s) => s.currency === data.currency)
          .map((s) => ({
            id: s.id,
            remaining:
              BigInt(s.depositMinor) -
              state.settlements
                .flatMap((v) => v.allocations)
                .flatMap((a) => a.sources)
                .filter((src) => src.settlementId === s.id)
                .reduce((n, src) => n + BigInt(src.amountMinor), 0n),
          }));
        for (const allocation of allocations) {
          let needed = BigInt(allocation.creditMinor);
          for (const source of available) {
            const used = source.remaining < needed ? source.remaining : needed;
            if (used > 0n)
              allocation.sources.push({
                settlementId: source.id,
                amountMinor: used.toString(),
              });
            source.remaining -= used;
            needed -= used;
          }
          if (needed > 0n)
            throw new AppError(409, "Crédit disponible insuffisant.");
        }
        const at = new Date(this.now()).toISOString();
        const value: Settlement = {
          id: randomUUID(),
          patientId,
          currency: data.currency,
          actorId: c.accountId,
          at,
          receiptNumber:
            money > 0n
              ? await r.nextReceipt(new Date(at).getUTCFullYear())
              : null,
          methodId: method?.id ?? null,
          methodName: method?.name ?? null,
          newMoneyMinor: money.toString(),
          depositMinor: deposit.toString(),
          creditUsedMinor: creditUsed.toString(),
          allocations,
          identity: await r.documentIdentity(patientId),
        };
        await r.settlement(value);
        await r.save(data.commandId, c.accountId, replay.hash, value);
        return { clinicId: c.clinicId, value };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
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
          throw new AppError(
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
        if (!currency) throw new AppError(400, "Devise non activée.");
        if (Date.parse(data.asOf) > this.now())
          throw new AppError(400, "Date future interdite.");
        const amount = exactMinor(data.amount, currency.precision);
        if (amount <= 0n) throw new AppError(400, "Solde positif requis.");
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
        if (!charge) throw new AppError(404, "Charge introuvable.");
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
          throw new AppError(409, "Relisez la charge et la version acceptée.");
        const item = plan.items.find((i) => i.id === charge.itemId);
        if (!item) throw new AppError(409, "Acte accepté introuvable.");
        const target = agreed(item),
          delta = target - BigInt(charge.chargedMinor);
        if (target < BigInt(charge.paidMinor))
          throw new AppError(
            409,
            "Les fonds alloués nécessitent une correction explicite avant réduction.",
          );
        if (delta === 0n)
          throw new AppError(409, "Charge déjà réconciliée.");
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
