import type { HistoricalSnapshot } from "@clinic/contracts";
import type { ClinicTransaction } from "../../database.js";
import { AppError } from "../../errors/app-error.js";
export class HistoricalRepository {
  constructor(
    readonly tx: ClinicTransaction,
    readonly clinicId: string,
  ) {}
  async capture(
    id: string,
    patientId: string,
    accountId: string,
    snapshot: HistoricalSnapshot,
  ) {
    await this.tx.historicalRemoval.create({
      data: {
        id,
        clinicId: this.clinicId,
        patientId,
        accountId,
        cutoff: new Date(snapshot.cutoff),
        snapshot,
      },
    });
  }
  async removal(patientId: string, accountId: string, removalId: string) {
    return this.tx.historicalRemoval.findFirst({
      where: { clinicId: this.clinicId, patientId, accountId, id: removalId },
    });
  }
  async grant(patientId: string, accountId: string, removalId: string) {
    await this.tx.historicalGrant.upsert({
      where: {
        clinicId_patientId_accountId: {
          clinicId: this.clinicId,
          patientId,
          accountId,
        },
      },
      create: { clinicId: this.clinicId, patientId, accountId, removalId },
      update: { removalId },
    });
  }
  async revoke(patientId: string, accountId: string) {
    await this.tx.historicalGrant.deleteMany({
      where: { clinicId: this.clinicId, patientId, accountId },
    });
  }
  async snapshot(patientId: string, accountId: string) {
    const grant = await this.tx.historicalGrant.findFirst({
      where: { clinicId: this.clinicId, patientId, accountId },
    });
    const row =
      grant && (await this.removal(patientId, accountId, grant.removalId));
    if (!row) throw new AppError(403, "Accès historique non autorisé.");
    return row.snapshot as unknown as HistoricalSnapshot;
  }
  async patients(accountId: string) {
    const grants = await this.tx.historicalGrant.findMany({
      where: { clinicId: this.clinicId, accountId },
    });
    return Promise.all(
      grants.map(async (g) => {
        const s = await this.snapshot(g.patientId, accountId);
        return {
          id: s.patient.id,
          name: s.patient.name,
          patientNumber: s.patient.patientNumber,
          cutoff: s.cutoff,
        };
      }),
    );
  }
}
