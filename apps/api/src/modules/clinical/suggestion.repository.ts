import type { ClinicTransaction } from "../../database.js";
export class SuggestionRepository {
  constructor(
    readonly tx: ClinicTransaction,
    readonly clinicId: string,
    readonly patientId: string,
  ) {}
  decisions() {
    return this.tx.chartSuggestionDecision.findMany({
      where: { clinicId: this.clinicId, patientId: this.patientId },
    });
  }
  save(completionId: string, status: string, actorId: string, at: Date) {
    return this.tx.chartSuggestionDecision.create({
      data: {
        clinicId: this.clinicId,
        patientId: this.patientId,
        completionId,
        status,
        actorId,
        at,
      },
    });
  }
}
