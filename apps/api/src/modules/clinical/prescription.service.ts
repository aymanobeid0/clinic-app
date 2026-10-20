import { AppError } from '../../errors/app-error.js';
import type { z } from "zod";
import type {
  PrescriptionContent,
  Prescription,
  ClinicalRecord,
  prescriptionDraftSchema,
  clinicalConfirmSchema,
} from "@clinic/contracts";
import type { Actor, IdentityAccess } from "../identity/index.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { ClinicalRepository } from "./clinical.repository.js";
import { PrescriptionRepository } from "./prescription.repository.js";
export class PrescriptionService {
  constructor(
    readonly identity: IdentityAccess,
    readonly updates: ClinicUpdates,
    readonly now: () => number,
  ) {}
  private visible(
    id: string,
    record: ClinicalRecord<PrescriptionContent>,
    permissions: readonly string[],
  ): Prescription {
    return {
      ...record,
      id,
      events: permissions.includes("clinical.history") ? record.events : [],
    };
  }
  list(actor: Actor | undefined, patientId: string) {
    return this.identity.withClinicalPermission(
      actor,
      patientId,
      "clinical.read",
      async (c, tx) => {
        const ids = await new PrescriptionRepository(tx, c.clinicId).ids(
            patientId,
          ),
          r = new ClinicalRepository(tx, c.clinicId, patientId);
        return Promise.all(
          ids.map(async (id) =>
            this.visible(
              id,
              await r.record<PrescriptionContent>("prescription:" + id),
              c.permissions,
            ),
          ),
        );
      },
    );
  }
  get(actor: Actor | undefined, patientId: string, id: string) {
    return this.identity.withClinicalPermission(
      actor,
      patientId,
      "clinical.read",
      async (c, tx) =>
        this.visible(
          id,
          await new ClinicalRepository(
            tx,
            c.clinicId,
            patientId,
          ).record<PrescriptionContent>("prescription:" + id),
          c.permissions,
        ),
    );
  }
  print(
    actor: Actor | undefined,
    patientId: string,
    id: string,
    revision: number,
  ) {
    return this.identity.withClinicalPermission(
      actor,
      patientId,
      "clinical.print",
      async (c, tx) => {
        if (!c.permissions.includes("clinical.read"))
          throw new AppError(403, "Lecture clinique requise.");
        const record = await new ClinicalRepository(
          tx,
          c.clinicId,
          patientId,
        ).record<PrescriptionContent>("prescription:" + id);
        const version = record.events.find(
          (v) => v.revision === revision && v.status === "final",
        );
        if (!version)
          throw new AppError(404, "Ordonnance émise introuvable.");
        if (
          record.current?.revision !== revision &&
          !c.permissions.includes("clinical.history")
        )
          throw new AppError(
            403,
            "Historique clinique requis pour une ancienne version.",
          );
        return {
          id,
          version,
          superseded: record.current?.revision !== revision,
          replacedBy:
            record.events.find(
              (v) => v.status === "final" && v.content.replaces === revision,
            )?.revision ?? null,
        };
      },
    );
  }
  async change(
    actor: Actor | undefined,
    patientId: string,
    id: string,
    action: "draft" | "finalize",
    data:
      | z.infer<typeof prescriptionDraftSchema>
      | z.infer<typeof clinicalConfirmSchema>,
  ) {
    const result = await this.identity.withClinicalPermission(
      actor,
      patientId,
      action === "draft" ? "prescriptions.draft" : "prescriptions.sign",
      async (c, tx) => {
        if (!c.permissions.includes("clinical.read"))
          throw new AppError(403, "Lecture clinique requise.");
        const r = new ClinicalRepository(tx, c.clinicId, patientId),
          kind = "prescription:" + id;
        await r.lock(kind);
        const replay = await r.replay<PrescriptionContent>(
            data.commandId,
            [patientId, id, action, data],
            c.accountId,
          ),
          record = await r.record<PrescriptionContent>(kind);
        if (replay.receipt)
          return {
            clinicId: c.clinicId,
            value: this.visible(
              id,
              { ...record, revision: replay.receipt.revision },
              c.permissions,
            ),
          };
        if (record.revision !== data.revision)
          throw new AppError(
            409,
            "Cette ordonnance a changé. Comparez le serveur avec votre saisie conservée.",
          );
        const at = new Date(this.now()).toISOString();
        let content: PrescriptionContent;
        let authorId = c.accountId;
        if ("content" in data) {
          if (record.current && !data.reason)
            throw new AppError(400, "Motif de correction requis.");
          content = {
            ...data.content,
            reason: data.reason,
            replaces: record.current?.revision ?? null,
          };
        } else {
          if (!record.draft)
            throw new AppError(409, "Un brouillon est requis.");
          authorId = record.draft.authorId;
          const [identity, template] = await Promise.all([
            new PrescriptionRepository(tx, c.clinicId).printIdentity(patientId),
            new PrescriptionRepository(tx, c.clinicId).template(),
          ]);
          content = {
            ...record.draft.content,
            issued: {
              ...identity,
              ...template,
              prescriberId: c.accountId,
              prescriberName: await r.name(c.accountId),
              issuedAt: at,
            },
          };
        }
        const saved = await r.append(
          kind,
          data.commandId,
          replay.hash,
          c.accountId,
          {
            revision: record.revision + 1,
            observedAt: action === "draft" ? at : record.draft!.observedAt,
            recordedAt: at,
            authorId,
            authorName: await r.name(authorId),
            finalizerId: action === "finalize" ? c.accountId : null,
            finalizerName:
              action === "finalize" ? await r.name(c.accountId) : null,
            status: action === "draft" ? "draft" : "final",
            content,
          },
        );
        return {
          clinicId: c.clinicId,
          value: this.visible(id, saved, c.permissions),
        };
      },
    );
    this.updates.publish(result.clinicId,'prescriptions:'+patientId);
    return result.value;
  }
}
