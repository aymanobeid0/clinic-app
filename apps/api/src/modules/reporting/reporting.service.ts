import { pendingNoteTasks } from "../clinical/index.js";
import type { z } from "zod";
import type {
  createFollowUpSchema,
  updateFollowUpSchema,
  FollowUp,
  FollowUpList,
  StockReport,
  AppointmentReport,
} from "@clinic/contracts";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { reportInventory } from "../inventory/index.js";
import { AppError } from "../../errors/app-error.js";
import type { FinancialReport, FinancialReportTotal } from "@clinic/contracts";
import { reportPatientBilling } from "../billing/index.js";
import { ReportingRepository } from "./reporting.repository.js";
import type { Actor, IdentityAccess } from "../identity/index.js";
import { reportAppointments } from "../scheduling/index.js";
export class ReportingService {
  constructor(
    readonly identity: IdentityAccess,
    readonly now: () => number,
    readonly updates: ClinicUpdates,
  ) {}
  authorizeEvents(
    actor: Actor | undefined,
    category: "operational" | "financial",
  ) {
    return this.identity.withReportScope(actor, category, async (c) => ({
      clinicId: c.clinicId,
      scopes:
        category === "operational"
          ? ["inventory", ...c.clinicalPatientIds.map((id) => `notes:${id}`)]
          : [],
    }));
  }
  tasks(actor: Actor | undefined): Promise<FollowUpList> {
    return this.identity.withReportScope(
      actor,
      "operational",
      async (c, tx) => {
        const events = await new ReportingRepository(tx, c.clinicId).events(
          c.patientIds,
        );
        const latest = new Map(events.map((e) => [e.id, e]));
        return {
          tasks: [...latest.values()].sort(
            (a, b) =>
              a.dueOn.localeCompare(b.dueOn) || a.id.localeCompare(b.id),
          ),
          pendingNotes: await pendingNoteTasks(
            tx,
            c.clinicId,
            c.clinicalPatientIds,
          ),
        };
      },
    );
  }
  history(actor: Actor | undefined, id: string, share = false) {
    return this.identity.withReportScope(
      actor,
      "operational",
      async (c, tx) => {
        const r = new ReportingRepository(tx, c.clinicId),
          events = await r.events(c.patientIds, id),
          task = events.at(-1);
        if (!task) throw new AppError(404, "Tâche introuvable.");
        if (!share) return { events };
        const patient = (await r.patients([task.patientId]))[0]!;
        return {
          delivery: "manual",
          text: `Bonjour ${patient.name}, merci de contacter ${await r.clinicName()}.`,
        };
      },
    );
  }
  async changeTask(
    actor: Actor | undefined,
    id: string | undefined,
    data:
      | z.infer<typeof createFollowUpSchema>
      | z.infer<typeof updateFollowUpSchema>,
  ) {
    const result = await this.identity.withReportScope(
      actor,
      "operational",
      async (c, tx) => {
        const r = new ReportingRepository(tx, c.clinicId);
        const current = id
          ? (await r.events(c.patientIds, id)).at(-1)
          : undefined;
        if (id && !current) throw new AppError(404, "Tâche introuvable.");
        const patientId =
          "patientId" in data ? data.patientId : current!.patientId;
        if (
          (c.patientIds !== null && !c.patientIds.includes(patientId)) ||
          !(await r.patients([patientId])).length
        )
          throw new AppError(404, "Patient introuvable.");
        const replay = await r.replay(data.commandId, c.accountId, [
          id ?? null,
          data,
        ]);
        if (replay.receipt)
          return { clinicId: c.clinicId, value: replay.receipt };
        if (current && "revision" in data && current.revision !== data.revision)
          throw new AppError(409, "Cette tâche a changé. Actualisez-la et vérifiez votre saisie avant de confirmer à nouveau.");
        const value: FollowUp = {
          id: current?.id ?? data.commandId,
          patientId,
          kind: "contact_patient",
          dueOn: data.dueOn ?? current!.dueOn,
          status: "status" in data ? data.status : "open",
          revision: (current?.revision ?? 0) + 1,
          actorId: c.accountId,
          at: new Date(this.now()).toISOString(),
        };
        return {
          clinicId: c.clinicId,
          value: await r.append(data.commandId, replay.hash, value),
        };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
  stock(actor: Actor | undefined): Promise<StockReport> {
    return this.identity.withReportScope(
      actor,
      "operational",
      async (c, tx) => {
        if (!c.permissions.includes("inventory.read"))
          throw new AppError(403, "Lecture du stock requise.");
        const stock = await reportInventory(
          tx,
          c.clinicId,
          c.accountId,
          this.now,
        );
        return {
          asOfDate: stock.asOfDate,
          settings: stock.settings,
          lowStock: stock.items.filter((i) => i.active && i.lowStock),
          expiring: stock.batches.filter(
            (b) => b.remainingPacks > 0 && b.expiring,
          ),
          expired: stock.batches.filter(
            (b) => b.remainingPacks > 0 && b.expired,
          ),
        };
      },
    );
  }
  financial(actor: Actor | undefined, date: string): Promise<FinancialReport> {
    return this.identity.withReportScope(actor, "financial", async (c, tx) => {
      const patients = [];
      const totals = new Map<string, FinancialReportTotal>();
      for (const p of await new ReportingRepository(tx, c.clinicId).patients(
        c.patientIds,
      )) {
        const value = await reportPatientBilling(
          tx,
          {
            ...c,
            clinical:
              c.financialClinical || c.clinicalPatientIds.includes(p.id),
          },
          p.id,
          date,
        );
        if (!value.totals.length) continue;
        patients.push({
          patientId: p.id,
          patientNumber: p.patientNumber,
          name: p.name,
          ...value,
        });
        for (const t of value.totals) {
          const aggregate = totals.get(t.currency);
          if (!aggregate) totals.set(t.currency, { ...t });
          else
            for (const key of Object.keys(t) as (keyof FinancialReportTotal)[])
              if (key !== "currency")
                aggregate[key] = (
                  BigInt(aggregate[key]) + BigInt(t[key])
                ).toString();
        }
      }
      return {
        date,
        balanceAsOf: new Date(this.now()).toISOString(),
        patients,
        totals: [...totals.values()].sort((a, b) =>
          a.currency.localeCompare(b.currency),
        ),
      };
    });
  }
  appointments(
    actor: Actor | undefined,
    date: string,
  ): Promise<AppointmentReport> {
    return this.identity.withReportScope(
      actor,
      "operational",
      async (c, tx) => ({
        date,
        appointments: await reportAppointments(
          tx,
          c.clinicId,
          c.accountId,
          date,
          c.patientIds,
        ),
      }),
    );
  }
}
