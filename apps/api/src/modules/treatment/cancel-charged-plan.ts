import { AppError } from "../../errors/app-error.js";
import type { ClinicTransaction } from "../../database.js";
import { TreatmentRepository } from "./treatment.repository.js";

// Called only inside the authorized billing transaction after all final charges.
export async function cancelChargedPlan(
  tx: ClinicTransaction,
  clinicId: string,
  patientId: string,
  planId: string,
  revision: number,
  actorId: string,
  reason: string,
  at: string,
) {
  const repository = new TreatmentRepository(tx, clinicId);
  const old = (await repository.versions(patientId, planId)).at(-1);
  if (
    !old ||
    old.revision !== revision ||
    !["accepted", "in_progress", "completed"].includes(old.status)
  )
    throw new AppError(409, "Relisez le plan à annuler.");
  const name = await repository.name(actorId);
  await repository.append(patientId, {
    ...old,
    revision: old.revision + 1,
    status: "cancelled",
    authorId: actorId,
    authorName: name,
    recordedAt: at,
    cancellation: { actorId, actorName: name, reason, at },
  });
}
