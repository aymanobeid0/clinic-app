import { noteVisits } from "../treatment/index.js";
import { ClinicalRepository } from "./clinical.repository.js";
// Safe task metadata only: never return note text or revision contents to reporting.
export async function pendingNoteTasks(
  tx: import("../../database.js").ClinicTransaction,
  clinicId: string,
  patientIds: string[],
): Promise<import("@clinic/contracts").PendingNoteTask[]> {
  const tasks: import("@clinic/contracts").PendingNoteTask[] = [];
  for (const patientId of patientIds) {
    for (const visit of await noteVisits(tx, clinicId, patientId)) {
      if (visit.status !== "ended") continue;
      const record = await new ClinicalRepository(
        tx,
        clinicId,
        patientId,
      ).record<import("@clinic/contracts").VisitNoteContent>(
        `note:${visit.id}`,
      );
      if (!record.current || record.draft)
        tasks.push({
          id: `note:${visit.id}`,
          patientId,
          visitId: visit.id,
          kind: "pending_note",
          status: "open",
        });
    }
  }
  return tasks;
}
