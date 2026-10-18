import type { z } from "zod";
import type {
  medicationCommandSchema,
  prescriptionTemplateSchema,
} from "@clinic/contracts";
import {
  IdentityError,
  type Actor,
  type IdentityAccess,
} from "../identity/index.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { PrescriptionRepository } from "./prescription.repository.js";
export class MedicationService {
  constructor(
    readonly identity: IdentityAccess,
    readonly updates: ClinicUpdates,
  ) {}
  authorize(actor: Actor | undefined) {
    return this.identity.withMedicationReference(
      actor,
      async (c) => c.clinicId,
      false,
    );
  }
  list(actor: Actor | undefined, q: string, retired: boolean) {
    return this.identity.withMedicationReference(
      actor,
      (c, tx) =>
        new PrescriptionRepository(tx, c.clinicId).medications(q, retired),
      false,
    );
  }
  template(actor: Actor | undefined) {
    return this.identity.withMedicationReference(actor, (c, tx) =>
      new PrescriptionRepository(tx, c.clinicId).template(),
    );
  }
  async save(
    actor: Actor | undefined,
    data: z.infer<typeof medicationCommandSchema>,
  ) {
    const result = await this.identity.withMedicationReference(
      actor,
      async (c, tx) => {
        const commands = new PrescriptionRepository(tx, c.clinicId);
        await commands.lock();
        const replay = await commands.replay(
          data.commandId,
          ["medication", data],
          c.accountId,
        );
        if (replay.receipt)
          return { clinicId: c.clinicId, value: replay.receipt };
        const r = new PrescriptionRepository(tx, c.clinicId),
          old = await r.medication(data.id);
        if ((old?.revision ?? 0) !== data.revision)
          throw new IdentityError(
            409,
            "Cette référence a changé. Relisez avant de réessayer.",
          );
        if (
          data.active &&
          (await r.exactMedication(
            data.name,
            data.strength,
            data.form,
            data.id,
          ))
        )
          throw new IdentityError(409, "Cette référence existe déjà.");
        const value = {
          id: data.id,
          name: data.name,
          strength: data.strength,
          form: data.form,
          active: data.active,
          revision: data.revision + 1,
        };
        await r.putMedication(value);
        await commands.save(data.commandId, c.accountId, replay.hash, value);
        return { clinicId: c.clinicId, value };
      },
    );
    this.updates.publish(result.clinicId,'medications');
    return result.value;
  }
  async saveTemplate(
    actor: Actor | undefined,
    data: z.infer<typeof prescriptionTemplateSchema>,
  ) {
    return this.identity.withManager(actor, async (c, tx) => {
      const commands = new PrescriptionRepository(tx, c.clinicId);
      await commands.lock();
      const replay = await commands.replay(
        data.commandId,
        ["prescription-template", data],
        c.accountId,
      );
      if (replay.receipt) return replay.receipt;
      const r = new PrescriptionRepository(tx, c.clinicId);
      if ((await r.template()).revision !== data.revision)
        throw new IdentityError(409, "Le modèle a changé.");
      const value = {
        revision: data.revision + 1,
        header: data.header,
        footer: data.footer,
      };
      await r.putTemplate(value);
      await commands.save(data.commandId, c.accountId, replay.hash, value);
      return value;
    });
  }
}
