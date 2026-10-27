import { projectBilling } from "./billing.projection.js";
import { AppError } from "../../errors/app-error.js";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type {
  BillingWorkspace,
  BillingAdjustment,
  OpeningBalance,
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
  FinancialCorrection,
  creditAdjustmentSchema,
  releaseAllocationSchema,
  refundRequestSchema,
  refundActionSchema,
  reversePaymentSchema,
  cancelChargedPlanSchema,
  consultationPaymentSchema,
} from "@clinic/contracts";
import type { Actor, IdentityAccess } from "../identity/index.js";
import { treatmentBilling, exactMinor } from "../treatment/index.js";
import type { ClinicTransaction } from "../../database.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { projectFunds, releaseFunds } from "./funds.js";
import { BillingRepository } from "./billing.repository.js";

const agreed = (item: TreatmentItem) =>
  BigInt(item.priceMinor) -
  BigInt(item.discountMinor) +
  (item.extras ?? []).reduce((n, e) => n + BigInt(e.amountMinor), 0n);
// A reservation is a funding target, never a started-care charge or debt.
const fundingTargets = (state: BillingWorkspace) => [
  ...state.charges,
  ...state.settlements.flatMap((s) =>
    s.consultation
      ? [
          {
            id: s.consultation.chargeId,
            currency: s.currency,
            performedBy: s.consultation.performedBy,
          },
        ]
      : [],
  ),
];
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
  async payConsultation(
    actor: Actor | undefined,
    patientId: string,
    id: string,
    data: z.infer<typeof consultationPaymentSchema>,
  ) {
    const result = await this.identity.withFinancialPermission(
      actor,
      patientId,
      "billing.edit",
      async (c, tx) => {
        const plans = treatmentBilling(tx, c.clinicId),
          r = new BillingRepository(tx, c.clinicId);
        await plans.lock();
        const consultation = await plans.consultation(patientId, id);
        if (!consultation) throw new AppError(404, "Consultation introuvable.");
        if (c.ownWork && consultation.doctorId !== c.accountId)
          throw new AppError(403, "Périmètre financier non autorisé.");
        const replay = await r.replay(data.commandId, c.accountId, [
          "consultation-payment",
          patientId,
          id,
          data,
        ]);
        if (replay.receipt)
          return { clinicId: c.clinicId, value: replay.receipt };
        if (consultation.revision !== data.revision)
          throw new AppError(409, "La consultation a changé.");
        const currency = await plans.currency(data.currency);
        if (!currency || data.currency !== consultation.currency)
          throw new AppError(400, "Devise différente ou non activée.");
        const amount = exactMinor(data.amount, currency.precision);
        if (amount <= 0n || amount !== BigInt(consultation.priceMinor))
          throw new AppError(409, "Paiement intégral du tarif convenu requis.");
        const state = await projectBilling(tx, c, patientId);
        const charge = state.charges.find(
          (ch) => ch.sourceKind === "consultation" && ch.consultationId === id,
        );
        const chargeId = charge?.id ?? id;
        const funds = await this.funds(tx, c, patientId);
        if (
          funds.allocations
            .filter((a) => a.chargeId === chargeId)
            .some(
              (a) => BigInt(a.newMoneyMinor) + BigInt(a.creditMinor) > 0n,
            ) ||
          (charge && BigInt(charge.dueMinor) !== amount)
        )
          throw new AppError(409, "Consultation déjà réglée ou corrigée.");
        const method = (await r.methods()).find(
          (m) => m.id === data.methodId && m.active,
        );
        if (!method) throw new AppError(400, "Moyen de paiement actif requis.");
        const at = new Date(this.now()).toISOString();
        await plans.freezeConsultation(patientId, id, at, c.accountId);
        const value: Settlement = {
          id: randomUUID(),
          patientId,
          currency: data.currency,
          actorId: c.accountId,
          at,
          receiptNumber: await r.nextReceipt(new Date(at).getUTCFullYear()),
          methodId: method.id,
          methodName: method.name,
          newMoneyMinor: amount.toString(),
          depositMinor: "0",
          creditUsedMinor: "0",
          allocations: [
            {
              chargeId,
              newMoneyMinor: amount.toString(),
              creditMinor: "0",
              sources: [],
            },
          ],
          consultation: {
            consultationId: id,
            chargeId,
            performedBy: consultation.doctorId,
          },
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
  private async correct(
    actor: Actor | undefined,
    patientId: string,
    permission: "discounts" | "billing.edit" | "refunds" | "reversals",
    kind: FinancialCorrection["kind"],
    data: { commandId: string; reason: string },
    perform: (
      c: Scope & { canApprove: boolean; canCancelClinical: boolean },
      tx: ClinicTransaction,
      state: BillingWorkspace,
      value: FinancialCorrection,
    ) => Promise<void>,
  ) {
    const result = await this.identity.withFinancialPermission(
      actor,
      patientId,
      permission,
      async (c, tx) => {
        await treatmentBilling(tx, c.clinicId).lock();
        const r = new BillingRepository(tx, c.clinicId);
        const state = await projectBilling(tx, c, patientId);
        const replay = await r.replay(data.commandId, c.accountId, [
          kind,
          patientId,
          data,
        ]);
        if (replay.receipt) {
          const prior = replay.receipt as unknown as FinancialCorrection;
          if (
            !state.corrections.some((v) => v.id === prior.id) ||
            (kind === "refund_approval" && !c.canApprove) ||
            (kind === "cancellation" && !c.canCancelClinical)
          )
            throw new AppError(403, "Périmètre de correction non autorisé.");
          return {
            clinicId: c.clinicId,
            value: state.corrections.find((v) => v.id === prior.id)!,
          };
        }
        const value: FinancialCorrection = {
          id: randomUUID(),
          patientId,
          currency: "",
          actorId: c.accountId,
          at: new Date(this.now()).toISOString(),
          reason: data.reason,
          kind,
          chargeIds: [],
          invoiceIds: [],
          settlementIds: [],
          releases: [],
          credits: [],
        };
        await perform(c, tx, state, value);
        const invoices = await r.invoices(patientId);
        value.invoiceIds = invoices
          .filter((i) =>
            i.items.some((it) => value.chargeIds.includes(it.chargeId)),
          )
          .map((i) => i.id);
        await r.correction(value);
        await r.save(data.commandId, c.accountId, replay.hash, value);
        return {
          clinicId: c.clinicId,
          value: {
            ...value,
            invoiceIds: invoices
              .filter(
                (i) =>
                  value.invoiceIds.includes(i.id) &&
                  (!c.ownWork ||
                    i.items.every((it) => it.performedBy === c.accountId)),
              )
              .map((i) => i.id),
          },
        };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
  private async funds(tx: ClinicTransaction, c: Scope, patientId: string) {
    const entries = await new BillingRepository(tx, c.clinicId).entries(
      patientId,
    );
    const corrections = entries
      .filter((e) => e.kind === "correction")
      .map((e) => e.snapshot as unknown as FinancialCorrection);
    return {
      ...projectFunds(
        entries
          .filter((e) => e.kind === "settlement")
          .map((e) => e.snapshot as unknown as Settlement),
        corrections,
      ),
      corrections,
    };
  }
  private async reduce(
    tx: ClinicTransaction,
    c: Scope,
    state: BillingWorkspace,
    value: FinancialCorrection,
    data: { chargeId: string; revision: number; finalCharge: string },
  ) {
    const charge = state.charges.find((ch) => ch.id === data.chargeId);
    if (!charge) throw new AppError(404, "Charge introuvable.");
    if (charge.revision !== data.revision)
      throw new AppError(
        409,
        "Cette charge a changé. Actualisez-la et vérifiez votre saisie avant de confirmer à nouveau.",
      );
    const plans = treatmentBilling(tx, c.clinicId);
    const currency = await plans.currency(charge.currency);
    const target = exactMinor(data.finalCharge, currency!.precision);
    if (
      target > BigInt(charge.chargedMinor) ||
      (target === BigInt(charge.chargedMinor) && value.kind !== "cancellation")
    )
      throw new AppError(409, "Une réduction explicite est requise.");
    value.currency = charge.currency;
    value.chargeIds.push(charge.id);
    const excess = BigInt(charge.paidMinor) - target;
    if (excess > 0n) {
      const released = releaseFunds(
        await this.funds(tx, c, state.patientId),
        charge.id,
        excess,
        charge.performedBy,
        charge.currency,
        randomUUID,
      );
      if (released.remaining)
        throw new AppError(409, "Fonds alloués insuffisants.");
      value.releases.push(...released.releases);
      value.credits.push(...released.credits);
      value.settlementIds.push(...released.releases.map((r) => r.settlementId));
    }
    const plan = charge.planId
      ? (await plans.versions(state.patientId, charge.planId))
          .filter((v) => v.acceptance)
          .at(-1)
      : undefined;
    await new BillingRepository(tx, c.clinicId).adjust(
      state.patientId,
      charge.currency,
      charge.performedBy,
      {
        id: randomUUID(),
        chargeId: charge.id,
        revision: charge.revision + 1,
        acceptedRevision: plan?.revision ?? 1,
        amountMinor: (target - BigInt(charge.chargedMinor)).toString(),
        targetMinor: target.toString(),
        reason: value.reason,
        actorId: c.accountId,
        at: value.at,
        correctionId: value.id,
      },
    );
  }
  credit(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof creditAdjustmentSchema>,
  ) {
    return this.correct(
      actor,
      patientId,
      "discounts",
      "credit",
      data,
      (c, tx, state, v) => this.reduce(tx, c, state, v, data),
    );
  }
  release(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof releaseAllocationSchema>,
  ) {
    return this.correct(
      actor,
      patientId,
      "billing.edit",
      "release",
      data,
      async (c, tx, state, v) => {
        const charge = fundingTargets(state).find(
          (ch) => ch.id === data.chargeId,
        );
        if (!charge) throw new AppError(404, "Charge introuvable.");
        const currency = await treatmentBilling(tx, c.clinicId).currency(
          charge.currency,
        );
        const amount = exactMinor(data.amount, currency!.precision);
        if (amount <= 0n) throw new AppError(400, "Montant positif requis.");
        const released = releaseFunds(
          await this.funds(tx, c, patientId),
          charge.id,
          amount,
          charge.performedBy,
          charge.currency,
          randomUUID,
          data.settlementId,
        );
        if (released.remaining)
          throw new AppError(409, "Allocation disponible insuffisante.");
        Object.assign(v, {
          currency: charge.currency,
          chargeIds: [charge.id],
          settlementIds: [data.settlementId],
          releases: released.releases,
          credits: released.credits,
        });
      },
    );
  }
  refundRequest(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof refundRequestSchema>,
  ) {
    return this.correct(
      actor,
      patientId,
      "refunds",
      "refund_request",
      data,
      async (c, tx, state, v) => {
        const lot = state.creditSources.find((l) => l.id === data.sourceId);
        if (!lot) throw new AppError(404, "Source de crédit introuvable.");
        const currency = await treatmentBilling(tx, c.clinicId).currency(
          lot.currency,
        );
        const amount = exactMinor(data.amount, currency!.precision);
        if (amount <= 0n) throw new AppError(400, "Montant positif requis.");
        if (amount > BigInt(lot.availableMinor))
          throw new AppError(409, "Crédit disponible insuffisant.");
        Object.assign(v, {
          currency: lot.currency,
          sourceId: lot.id,
          amountMinor: amount.toString(),
          settlementIds: [lot.rootSettlementId],
        });
        v.chargeIds = lot.chargeId ? [lot.chargeId] : [];
      },
    );
  }
  refundAction(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof refundActionSchema>,
    approve: boolean,
  ) {
    return this.correct(
      actor,
      patientId,
      "refunds",
      approve ? "refund_approval" : "refund",
      data,
      async (c, _tx, state, v) => {
        const request = state.corrections.find(
          (x) => x.id === data.requestId && x.kind === "refund_request",
        );
        if (!request) throw new AppError(404, "Demande introuvable.");
        const source = state.creditSources.find(
          (l) => l.id === request.sourceId,
        );
        if (!source) throw new AppError(404, "Source introuvable.");
        if (approve && !c.canApprove)
          throw new AppError(
            403,
            "Approbation du responsable ou du praticien concerné requise.",
          );
        const approval = state.corrections.find(
          (x) => x.requestId === request.id && x.kind === "refund_approval",
        );
        if (
          state.corrections.some(
            (x) => x.requestId === request.id && x.kind === "refund",
          )
        )
          throw new AppError(409, "Remboursement déjà exécuté.");
        if (approve && approval)
          throw new AppError(409, "Demande déjà approuvée.");
        if (!approve && !approval)
          throw new AppError(409, "Approbation requise.");
        if (BigInt(source.availableMinor) < BigInt(request.amountMinor!))
          throw new AppError(409, "Crédit disponible insuffisant.");
        Object.assign(v, {
          currency: request.currency,
          sourceId: source.id,
          amountMinor: request.amountMinor,
          requestId: request.id,
          chargeIds: request.chargeIds,
          settlementIds: request.settlementIds,
          ...(!approve ? { approvalId: approval!.id } : {}),
        });
      },
    );
  }
  reverse(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof reversePaymentSchema>,
  ) {
    return this.correct(
      actor,
      patientId,
      "reversals",
      "reversal",
      data,
      async (c, tx, state, v) => {
        const receipt = state.settlements.find(
          (s) => s.id === data.settlementId && s.receiptNumber,
        );
        if (!receipt) throw new AppError(404, "Paiement introuvable.");
        const funds = await this.funds(tx, c, patientId);
        if (funds.reversed.has(receipt.id))
          throw new AppError(409, "Paiement déjà contrepassé.");
        const lots = funds.lots.filter(
          (l) => l.rootSettlementId === receipt.id,
        );
        if (
          funds.corrections.some(
            (x) => x.kind === "refund" && lots.some((l) => l.id === x.sourceId),
          )
        )
          throw new AppError(
            409,
            "Des fonds ont été rendus; une contrepassation ne peut les effacer.",
          );
        if (
          c.ownWork &&
          lots.some(
            (l) =>
              BigInt(l.availableMinor) > 0n && l.performedBy !== c.accountId,
          )
        )
          throw new AppError(403, "Périmètre financier non autorisé.");
        // Original attribution survives even when every allocation was released.
        v.chargeIds = receipt.allocations
          .filter((a) => BigInt(a.newMoneyMinor) > 0n)
          .map((a) => a.chargeId);
        for (const a of funds.allocations) {
          const fresh = a.settlementId === receipt.id ? a.newMoneyMinor : "0";
          const sources = a.sources.filter(
            (src) =>
              lots.some((l) => l.id === src.settlementId) &&
              BigInt(src.amountMinor) > 0n,
          );
          if (fresh === "0" && !sources.length) continue;
          if (!fundingTargets(state).some((ch) => ch.id === a.chargeId))
            throw new AppError(403, "Périmètre financier non autorisé.");
          v.releases.push({
            settlementId: a.settlementId,
            chargeId: a.chargeId,
            newMoneyMinor: fresh,
            sources,
          });
          if (!v.chargeIds.includes(a.chargeId)) v.chargeIds.push(a.chargeId);
        }
        Object.assign(v, {
          currency: receipt.currency,
          reversedSettlementId: receipt.id,
          settlementIds: [
            ...new Set([receipt.id, ...v.releases.map((r) => r.settlementId)]),
          ],
          amountMinor: receipt.newMoneyMinor,
        });
      },
    );
  }
  cancel(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof cancelChargedPlanSchema>,
  ) {
    return this.correct(
      actor,
      patientId,
      "discounts",
      "cancellation",
      data,
      async (c, tx, state, v) => {
        if (!c.canCancelClinical)
          throw new AppError(403, "Annulation clinique autorisée requise.");
        const all = await projectBilling(
          tx,
          { ...c, ownWork: false },
          patientId,
        );
        const charges = all.charges.filter((ch) => ch.planId === data.planId);
        if (
          !charges.length ||
          charges.length !== data.charges.length ||
          new Set(data.charges.map((ch) => ch.chargeId)).size !==
            charges.length ||
          data.charges.some((ch) => !charges.some((x) => x.id === ch.chargeId))
        )
          throw new AppError(
            409,
            "Charge finale explicite requise pour chaque acte commencé.",
          );
        for (const ch of data.charges) await this.reduce(tx, c, state, v, ch);
        v.planId = data.planId;
        await treatmentBilling(tx, c.clinicId).cancel(
          patientId,
          data.planId,
          data.revision,
          c.accountId,
          data.reason,
          v.at,
        );
      },
    );
  }
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
        const state = await projectBilling(tx, c, patientId);
        const issued = await r.invoices(patientId);
        const items: Invoice["items"] = data.chargeIds.map((id) => {
          const charge = state.charges.find((ch) => ch.id === id);
          if (!charge) throw new AppError(404, "Charge introuvable.");
          if (
            !charge.planId ||
            !charge.itemId ||
            charge.sourceKind === "consultation"
          )
            throw new AppError(
              409,
              "La facture est réservée aux actes de traitement.",
            );
          if (
            !charge.completedAt ||
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
            completedAt: charge.completedAt,
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
        const full = await projectBilling(
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
        const state = await projectBilling(tx, c, patientId);
        const charges = state.charges.filter((ch) => ch.planId === planId);
        if (!plan || (c.ownWork && !charges.length))
          throw new AppError(404, "Plan introuvable.");
        if (plan.status !== "completed")
          throw new AppError(409, "Plan terminé requis.");
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
            if (!ch.completedAt || !ch.itemId)
              throw new AppError(409, "Acte terminé requis.");
            return {
              chargeId: ch.id,
              itemId: ch.itemId,
              performedBy: ch.performedBy,
              completedAt: ch.completedAt,
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
        return projectBilling(tx, c, patientId);
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
        const state = await projectBilling(tx, c, patientId);
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
        const state = await projectBilling(tx, c, patientId);
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
            if (charge.sourceKind === "consultation")
              throw new AppError(
                409,
                "Utilisez le règlement dédié de consultation (prochaine étape).",
              );
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
        if (c.ownWork && deposit > 0n)
          throw new AppError(
            403,
            "Le crédit non attribué nécessite une autorité financière générale.",
          );
        const available = state.creditSources
          .filter(
            (l) => l.currency === data.currency && !l.reservedConsultationId,
          )
          .map((l) => ({ id: l.id, remaining: BigInt(l.availableMinor) }));
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
        const state = await projectBilling(tx, c, patientId);
        const charge = state.charges.find((e) => e.id === data.chargeId);
        if (!charge) throw new AppError(404, "Charge introuvable.");
        const replay = await r.replay(data.commandId, c.accountId, [
          "reconcile",
          patientId,
          data,
        ]);
        if (replay.receipt)
          return { clinicId: c.clinicId, value: replay.receipt };
        const linkedInvoices = (await r.invoices(patientId)).filter((v) =>
          v.items.some((i) => i.chargeId === charge.id),
        );
        if (!charge.planId || charge.sourceKind === "consultation")
          throw new AppError(
            409,
            "La réconciliation du plan ne s’applique pas à une consultation.",
          );
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
        if (delta === 0n) throw new AppError(409, "Charge déjà réconciliée.");
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
        if (linkedInvoices.length) {
          value.correctionId = randomUUID();
          await r.correction({
            id: value.correctionId,
            patientId,
            currency: charge.currency,
            actorId: c.accountId,
            at: value.at,
            reason: data.reason,
            kind: "reconciliation",
            chargeIds: [charge.id],
            invoiceIds: linkedInvoices.map((i) => i.id),
            settlementIds: [],
            releases: [],
            credits: [],
          });
        }
        await r.adjust(patientId, charge.currency, charge.performedBy, value);
        await r.save(data.commandId, c.accountId, replay.hash, value);
        return { clinicId: c.clinicId, value };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
}
