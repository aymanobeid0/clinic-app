import {
  completeConsultationSchema,
  enterConsultationSchema,
  type Consultation,
  type Identity,
} from "@clinic/contracts";
import { activeAccount, activePatientScope } from "./consultation.access.js";
import { useConsultationCommand } from "./useConsultationCommand.js";
// Explicit room entry and consultation completion never imply payment, procedure
// completion, note finalization or encounter end. Existing hooks own those actions.
export function useConsultationCare(
  identity: Identity,
  consultation: Consultation,
  accessScope = "active",
) {
  const { patientId, id, revision } = consultation;
  const command = useConsultationCommand<Consultation>(
    identity,
    patientId,
    `${accessScope}:${id}`,
  );
  const allowed =
    activeAccount(identity) &&
    activePatientScope(accessScope) &&
    identity.kind === "doctor" &&
    identity.accountId === consultation.doctorId &&
    identity.permissions.includes("clinical.read") &&
    identity.permissions.includes("procedures.start");
  const path = `consultations/${encodeURIComponent(patientId)}`;
  return {
    command,
    allowed,
    enter: (visitId: string = consultation.visitId ?? crypto.randomUUID()) =>
      allowed && !command.denied
        ? command.save(
            `${path}/entry`,
            enterConsultationSchema
              .omit({ commandId: true })
              .parse({ id, revision, visitId }),
          )
        : Promise.resolve(undefined),
    complete: () =>
      allowed && !command.denied
        ? command.save(
            `${path}/complete`,
            completeConsultationSchema
              .omit({ commandId: true })
              .parse({ id, revision }),
          )
        : Promise.resolve(undefined),
    retry: () =>
      allowed && !command.denied ? command.retry() : Promise.resolve(undefined),
  };
}
