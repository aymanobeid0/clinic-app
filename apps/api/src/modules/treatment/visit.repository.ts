import type {
  Visit,
  ProcedureStart,
  ProcedureCompletion,
} from '@clinic/contracts';
import type { ClinicTransaction } from '../../database.js';
export class VisitRepository {
  constructor(
    readonly tx: ClinicTransaction,
    readonly clinicId: string,
  ) {}
  async noteVisits(patientId: string) {
    const rows = await this.tx.treatmentVisit.findMany({
      where: { clinicId: this.clinicId, patientId },
      select: { id: true, snapshot: true },
    });
    return rows.map((row) => {
      const v = row.snapshot as unknown as Visit;
      return { id: row.id, status: v.status };
    });
  }
  async state(patientId: string) {
    const [visits, starts, completions] = await Promise.all([
      this.tx.treatmentVisit.findMany({
        where: { clinicId: this.clinicId, patientId },
      }),
      this.tx.procedureStart.findMany({
        where: { clinicId: this.clinicId, patientId },
      }),
      this.tx.procedureCompletion.findMany({
        where: { clinicId: this.clinicId, patientId },
      }),
    ]);
    return {
      visits: visits
        .map((v) => v.snapshot as unknown as Visit)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
      starts: starts.map((s) => s.snapshot as unknown as ProcedureStart),
      completions: completions.map(
        (s) => s.snapshot as unknown as ProcedureCompletion,
      ),
    };
  }
  async update(visit: Visit) {
    await this.tx.treatmentVisit.update({
      where: { clinicId_id: { clinicId: this.clinicId, id: visit.id } },
      data: { snapshot: visit },
    });
  }
  async complete(event: ProcedureCompletion) {
    await this.tx.procedureCompletion.create({
      data: {
        id: event.id,
        clinicId: this.clinicId,
        patientId: event.patientId,
        planId: event.planId,
        itemId: event.itemId,
        visitId: event.visitId,
        snapshot: event,
      },
    });
  }
  async existing(id: string) {
    return this.tx.treatmentVisit.findFirst({
      where: { clinicId: this.clinicId, id },
    });
  }
  async create(visit: Visit) {
    await this.tx.treatmentVisit.create({
      data: {
        id: visit.id,
        clinicId: this.clinicId,
        patientId: visit.patientId,
        appointmentId: visit.appointmentId,
        snapshot: visit,
      },
    });
  }
  async start(event: ProcedureStart) {
    await this.tx.procedureStart.create({
      data: {
        id: event.id,
        clinicId: this.clinicId,
        patientId: event.patientId,
        planId: event.planId,
        itemId: event.itemId,
        visitId: event.visitId,
        snapshot: event,
      },
    });
  }
  async available(patientId: string) {
    return !!(await this.tx.patient.findFirst({
      where: { clinicId: this.clinicId, id: patientId, archived: false },
    }));
  }
}
