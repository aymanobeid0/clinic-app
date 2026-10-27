import type { z } from "zod";
import { randomUUID } from "node:crypto";
import type {
  Consultation,
  ConsultationPrice,
  Remuneration,
  Visit,
  bookConsultationSchema,
  enterConsultationSchema,
  completeConsultationSchema,
  consultationPriceSchema,
  remunerationSchema,
} from "@clinic/contracts";
import type { Actor, IdentityAccess } from "../identity/index.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { AppError } from "../../errors/app-error.js";
import {
  ConsultationRepository,
  type ConsultationRecord,
} from "./consultation.repository.js";
import { TreatmentRepository } from "./treatment.repository.js";
import { VisitRepository } from "./visit.repository.js";
import { exactMinor } from "./treatment.service.js";
import {
  transitionVisitAppointment,
  validateConsultationAppointment,
} from "../scheduling/index.js";
import {
  createConsultationCharge,
  consultationFunds,
} from "../billing/index.js";

const canReadPrice = (c: {
  isManager: boolean;
  permissions: readonly string[];
}) => c.isManager || c.permissions.includes("billing.read");
const visible = (
  {
    remuneration: _remuneration,
    billingChargeId: _billingChargeId,
    priceMinor,
    currency,
    ...value
  }: ConsultationRecord,
  c: { isManager: boolean; permissions: readonly string[] },
): Consultation => {
  return { ...value, ...(canReadPrice(c) ? { priceMinor, currency } : {}) };
};
export class ConsultationService {
  constructor(
    readonly identity: IdentityAccess,
    readonly updates: ClinicUpdates,
    readonly now: () => number,
  ) {}
  private at() {
    return new Date(this.now()).toISOString();
  }
  list(actor: Actor | undefined, patientId: string | null, date?: string) {
    return this.identity.withConsultationScope(
      actor,
      patientId,
      async (c, tx) =>
        (
          await new ConsultationRepository(tx, c.clinicId).current(
            patientId ?? undefined,
          )
        )
          .filter(
            (v) =>
              (!date || v.date === date) &&
              (!c.ownDoctor ||
                (v.doctorId === c.accountId &&
                  c.patientIds.includes(v.patientId))),
          )
          .map((v) => visible(v, c)),
    );
  }
  price(actor: Actor | undefined) {
    return this.identity.withConsultationScope(actor, null, async (c, tx) => {
      if (!canReadPrice(c))
        throw new AppError(403, "Lecture financière requise pour le tarif.");
      return (await new ConsultationRepository(tx, c.clinicId).price()) ?? null;
    });
  }
  async setPrice(
    actor: Actor | undefined,
    data: z.infer<typeof consultationPriceSchema>,
  ) {
    const result = await this.identity.withManager(actor, async (c, tx) => {
      const plans = new TreatmentRepository(tx, c.clinicId),
        r = new ConsultationRepository(tx, c.clinicId);
      await plans.lock();
      const replay = await plans.replay(
        data.commandId,
        ["consultation-price", data],
        c.accountId,
      );
      if (replay.receipt)
        return {
          clinicId: c.clinicId,
          value: replay.receipt as unknown as ConsultationPrice,
        };
      const old = await r.price();
      if ((old?.revision ?? 0) !== data.revision)
        throw new AppError(409, "Le tarif a changé. Rechargez les paramètres.");
      const currency = await plans.enabled(data.currency);
      if (!currency) throw new AppError(409, "Devise non activée.");
      const value: ConsultationPrice = {
        revision: data.revision + 1,
        currency: data.currency,
        priceMinor: exactMinor(data.price, currency.precision).toString(),
        at: this.at(),
        actorId: c.accountId,
      };
      await r.setting("price", value);
      await plans.save(data.commandId, c.accountId, replay.hash, value);
      return { clinicId: c.clinicId, value };
    });
    this.updates.publish(result.clinicId);
    return result.value;
  }
  async setRemuneration(
    actor: Actor | undefined,
    data: z.infer<typeof remunerationSchema>,
  ) {
    const result = await this.identity.withManager(actor, async (c, tx) => {
      const plans = new TreatmentRepository(tx, c.clinicId),
        r = new ConsultationRepository(tx, c.clinicId);
      await plans.lock();
      const replay = await plans.replay(
        data.commandId,
        ["remuneration", data],
        c.accountId,
      );
      if (replay.receipt)
        return {
          clinicId: c.clinicId,
          value: replay.receipt as unknown as Remuneration,
        };
      const doctor = await r.activeDoctor(data.doctorId);
      if (!doctor) throw new AppError(409, "Dentiste actif requis.");
      const old = await r.remuneration(data.doctorId);
      if ((old?.revision ?? 0) !== data.revision)
        throw new AppError(
          409,
          "La rémunération a changé. Rechargez les paramètres.",
        );
      const value: Remuneration = {
        doctorId: data.doctorId,
        revision: data.revision + 1,
        mode: data.mode,
        rate: data.rate,
        at: this.at(),
        actorId: c.accountId,
      };
      await r.setting(data.doctorId, value);
      await plans.save(data.commandId, c.accountId, replay.hash, value);
      return { clinicId: c.clinicId, value };
    });
    this.updates.publish(result.clinicId);
    return result.value;
  }
  remunerationHistory(actor: Actor | undefined, doctorId: string) {
    return this.identity.withManager(actor, async (c, tx) => ({
      history: await new ConsultationRepository(tx, c.clinicId).settings(
        doctorId,
      ),
    }));
  }
  frozen(actor: Actor | undefined, patientId: string, id: string) {
    return this.identity.withFinancialPermission(
      actor,
      patientId,
      "billing.read",
      async (c, tx) => {
        await new TreatmentRepository(tx, c.clinicId).lock();
        const value = (
          await new ConsultationRepository(tx, c.clinicId).versions(
            patientId,
            id,
          )
        ).at(-1);
        if (!value) throw new AppError(404, "Consultation introuvable.");
        if (!c.canApprove || (c.ownWork && value.doctorId !== c.accountId))
          throw new AppError(403, "Rémunération non autorisée.");
        return value.remuneration
          ? {
              ...value.remuneration,
              ...(await consultationFunds(
                tx,
                c.clinicId,
                patientId,
                id,
                value.currency,
                value.remuneration.rate,
              )),
            }
          : null;
      },
    );
  }
  async book(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof bookConsultationSchema>,
  ) {
    const result = await this.identity.withConsultationScope(
      actor,
      patientId,
      async (c, tx) => {
        if (c.ownDoctor && data.doctorId !== c.accountId)
          throw new AppError(
            403,
            "Consultation d’un autre dentiste non autorisée.",
          );
        const plans = new TreatmentRepository(tx, c.clinicId),
          r = new ConsultationRepository(tx, c.clinicId);
        await plans.lock();
        const replay = await plans.replay(
          data.commandId,
          ["consultation-book", patientId, data],
          c.accountId,
        );
        if (replay.receipt)
          return {
            clinicId: c.clinicId,
            value: visible(replay.receipt as unknown as ConsultationRecord, c),
          };
        if ((await r.versions(undefined, data.id)).length)
          throw new AppError(409, "Identifiant de consultation déjà utilisé.");
        if (!(await new VisitRepository(tx, c.clinicId).available(patientId)))
          throw new AppError(409, "Patient indisponible ou archivé.");
        const doctor = await r.activeDoctor(data.doctorId);
        if (!doctor) throw new AppError(409, "Dentiste actif requis.");
        if (data.appointmentId)
          await validateConsultationAppointment(
            tx,
            c.clinicId,
            patientId,
            data.doctorId,
            data.appointmentId,
          );
        const price = await r.price();
        if (!price)
          throw new AppError(409, "Configurez le tarif de consultation.");
        if (
          data.price !== undefined &&
          !c.isManager &&
          !c.permissions.includes("prices.override")
        )
          throw new AppError(
            403,
            "Autorisation de modification du prix requise.",
          );
        const currency = await plans.enabled(price.currency);
        if (!currency) throw new AppError(409, "Devise non activée.");
        const value: ConsultationRecord = {
          id: data.id,
          patientId,
          doctorId: data.doctorId,
          appointmentId: data.appointmentId,
          date: data.date,
          revision: 1,
          status: "booked",
          currency: price.currency,
          priceMinor:
            data.price === undefined
              ? price.priceMinor
              : exactMinor(data.price, currency.precision).toString(),
          visitId: null,
          enteredAt: null,
          completedAt: null,
          at: this.at(),
          actorId: c.accountId,
          remuneration: null,
          billingChargeId: randomUUID(),
        };
        await r.append(value);
        await plans.save(data.commandId, c.accountId, replay.hash, value);
        return { clinicId: c.clinicId, value: visible(value, c) };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
  async care(
    actor: Actor | undefined,
    patientId: string,
    data:
      | z.infer<typeof enterConsultationSchema>
      | z.infer<typeof completeConsultationSchema>,
    action: "entry" | "complete",
  ) {
    const result = await this.identity.withClinicalPermission(
      actor,
      patientId,
      "procedures.start",
      async (c, tx) => {
        if (!c.permissions.includes("clinical.read"))
          throw new AppError(403, "Accès en lecture clinique requis.");
        const plans = new TreatmentRepository(tx, c.clinicId),
          r = new ConsultationRepository(tx, c.clinicId),
          visits = new VisitRepository(tx, c.clinicId);
        await plans.lock();
        const old = (await r.versions(patientId, data.id)).at(-1);
        if (!old) throw new AppError(404, "Consultation introuvable.");
        if (old.doctorId !== c.accountId)
          throw new AppError(
            403,
            "Seul le dentiste de la consultation peut enregistrer les soins.",
          );
        const replay = await plans.replay(
          data.commandId,
          ["consultation-" + action, patientId, data],
          c.accountId,
        );
        if (replay.receipt)
          return { clinicId: c.clinicId, value: visible(old, c) };
        if (old.revision !== data.revision)
          throw new AppError(
            409,
            "La consultation a changé. Rechargez les soins.",
          );
        const at = this.at();
        let value: ConsultationRecord;
        if (action === "entry" && "visitId" in data) {
          if (old.status !== "booked")
            throw new AppError(409, "Entrée déjà enregistrée.");
          if (!(await visits.available(patientId)))
            throw new AppError(409, "Patient indisponible ou archivé.");
          const remuneration =
            old.remuneration ?? (await r.remuneration(c.accountId));
          if (!remuneration)
            throw new AppError(
              409,
              "Configurez le mode de rémunération du dentiste.",
            );
          const state = await visits.state(patientId),
            open = state.visits.find(
              (v) => v.doctorId === c.accountId && v.status === "draft",
            );
          if (
            open &&
            (open.id !== data.visitId ||
              open.appointmentId !== old.appointmentId)
          )
            throw new AppError(
              409,
              "Utilisez la visite en cours et son rendez-vous.",
            );
          if (!open) {
            if (await visits.existing(data.visitId))
              throw new AppError(409, "Identifiant de visite déjà utilisé.");
            if (old.appointmentId)
              await transitionVisitAppointment(
                tx,
                c.clinicId,
                patientId,
                c.accountId,
                old.appointmentId,
                "start",
                this.now,
              );
            const visit: Visit = {
              id: data.visitId,
              patientId,
              doctorId: c.accountId,
              doctorName: await plans.name(c.accountId),
              appointmentId: old.appointmentId,
              revision: 1,
              status: "draft",
              startedAt: at,
              procedures: [],
            };
            await visits.create(visit);
          }
          value = {
            ...old,
            revision: old.revision + 1,
            status: "entered",
            visitId: data.visitId,
            enteredAt: at,
            remuneration,
            billingChargeId: old.billingChargeId ?? randomUUID(),
            at,
            actorId: c.accountId,
          };
          await createConsultationCharge(tx, c.clinicId, {
            sourceKind: "consultation",
            id: value.billingChargeId!,
            consultationId: old.id,
            patientId,
            performedBy: old.doctorId,
            currency: old.currency,
            agreedMinor: old.priceMinor,
            at,
          });
        } else {
          if (old.status !== "entered")
            throw new AppError(409, "Consultation entrée requise.");
          value = {
            ...old,
            revision: old.revision + 1,
            status: "completed",
            completedAt: at,
            at,
            actorId: c.accountId,
          };
        }
        await r.append(value);
        await plans.save(data.commandId, c.accountId, replay.hash, value);
        return { clinicId: c.clinicId, value: visible(value, c) };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
}
