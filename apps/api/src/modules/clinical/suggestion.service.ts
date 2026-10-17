import {
  chartContentSchema,
  type ChartContent,
  type ChartSuggestion,
  type chartSuggestionSchema,
} from "@clinic/contracts";
import type { z } from "zod";
import {
  IdentityError,
  type Actor,
  type IdentityAccess,
} from "../identity/index.js";
import { completedChartWork } from "../treatment/index.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { ClinicalRepository } from "./clinical.repository.js";
import { PrescriptionRepository } from "./prescription.repository.js";
import { SuggestionRepository } from "./suggestion.repository.js";
export class SuggestionService {
  constructor(
    readonly identity: IdentityAccess,
    readonly updates: ClinicUpdates,
    readonly now: () => number,
  ) {}
  list(actor: Actor | undefined, patientId: string) {
    return this.identity.withClinicalPermission(
      actor,
      patientId,
      "clinical.read",
      async (c, tx) => {
        const work = await completedChartWork(tx, c.clinicId, patientId),
          decisions = await new SuggestionRepository(
            tx,
            c.clinicId,
            patientId,
          ).decisions();
        return work.map((w) => ({
          ...w,
          status:
            decisions.find((d) => d.completionId === w.id)?.status ?? "pending",
        })) as ChartSuggestion[];
      },
    );
  }
  async change(
    actor: Actor | undefined,
    patientId: string,
    id: string,
    data: z.infer<typeof chartSuggestionSchema>,
  ) {
    const result = await this.identity.withClinicalPermission(
      actor,
      patientId,
      "chart.finalize",
      async (c, tx) => {
        if (!c.permissions.includes("clinical.read"))
          throw new IdentityError(403, "Lecture clinique requise.");
        const chart = new ClinicalRepository(tx, c.clinicId, patientId),
          commands = new PrescriptionRepository(tx, c.clinicId);
        await chart.lock();
        await commands.lock();
        const replay = await commands.replay(
          data.commandId,
          ["chart-suggestion", patientId, id, data],
          c.accountId,
        );
        if (replay.receipt)
          return { clinicId: c.clinicId, value: replay.receipt };
        const suggestion = (
          await completedChartWork(tx, c.clinicId, patientId)
        ).find((w) => w.id === id);
        if (!suggestion)
          throw new IdentityError(404, "Suggestion introuvable.");
        const r = new SuggestionRepository(tx, c.clinicId, patientId);
        if ((await r.decisions()).some((d) => d.completionId === id))
          throw new IdentityError(409, "Suggestion déjà traitée.");
        const record = await chart.record<ChartContent>("chart");
        if (record.revision !== data.chartRevision || record.draft)
          throw new IdentityError(
            409,
            "Relisez et confirmez le brouillon du schéma avant cette suggestion.",
          );
        const at = new Date(this.now()).toISOString();
        if (data.action === "confirm") {
          if (!data.targets.length)
            throw new IdentityError(400, "Confirmez les dents et surfaces.");
          const content: ChartContent = structuredClone(
            record.current?.content ?? {
              numberingScheme: "FDI",
              dentition: "mixed",
              teeth: [],
            },
          );
          const seen = new Set<string>();
          for (const target of data.targets) {
            if (
              seen.has(target.tooth) ||
              (suggestion.scope !== "whole_mouth" &&
                !suggestion.teeth.includes(target.tooth))
            )
              throw new IdentityError(400, "Cible incompatible avec l’acte.");
            seen.add(target.tooth);
            let tooth = content.teeth.find((t) => t.tooth === target.tooth);
            if (!tooth) {
              tooth = {
                tooth: target.tooth,
                presence: "unknown",
                extractionHistory: false,
                conditions: [],
                treatments: [],
              };
              content.teeth.push(tooth);
            }
            if (suggestion.category === "extraction") {
              tooth.presence = "missing";
              tooth.extractionHistory = true;
            } else if (suggestion.category === "restoration") {
              tooth.conditions.push({
                finding: "restoration",
                surfaces: target.conditions.flatMap((v) => v.surfaces),
                note: "Acte confirmé : " + suggestion.name,
              });
            } else if (!tooth.treatments.includes(suggestion.category))
              tooth.treatments.push(suggestion.category);
          }
          chartContentSchema.parse(content);
          await chart.append(
            "chart",
            data.commandId,
            replay.hash,
            c.accountId,
            {
              revision: record.revision + 1,
              observedAt: at,
              recordedAt: at,
              authorId: c.accountId,
              authorName: await chart.name(c.accountId),
              finalizerId: c.accountId,
              finalizerName: await chart.name(c.accountId),
              status: "final",
              content,
            },
          );
        }
        const value = {
          id,
          status: data.action === "confirm" ? "confirmed" : "dismissed",
        };
        await r.save(id, value.status, c.accountId, new Date(at));
        await commands.save(data.commandId, c.accountId, replay.hash, value);
        return { clinicId: c.clinicId, value };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
}
