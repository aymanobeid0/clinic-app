import type {
  Visit,
  ProcedureStart,
  ProcedureCompletion,
  Remuneration,
} from "@clinic/contracts";
import type { ClinicTransaction } from "../../database.js";
type StartRecord = ProcedureStart & { remuneration?: Remuneration | null };
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
      starts: starts.map((s) => {
        const visible = ({ remuneration: _, ...event }: StartRecord) => event;
        return visible(s.snapshot as unknown as StartRecord);
      }),
      completions: completions.map(
        (s) => s.snapshot as unknown as ProcedureCompletion,
      ),
    };
  }
  async completions(patientId: string): Promise<ProcedureCompletion[]> {
    const rows = await this.tx.procedureCompletion.findMany({
      where: { clinicId: this.clinicId, patientId },
    });
    return rows.map((row) => row.snapshot as unknown as ProcedureCompletion);
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
  async remunerationStart(patientId: string, id: string) {
    const row = await this.tx.procedureStart.findFirst({
      where: { clinicId: this.clinicId, patientId, id },
    });
    return row ? (row.snapshot as unknown as StartRecord) : null;
  }
  async start(event: ProcedureStart, remuneration: Remuneration | null) {
    await this.tx.procedureStart.create({
      data: {
        id: event.id,
        clinicId: this.clinicId,
        patientId: event.patientId,
        planId: event.planId,
        itemId: event.itemId,
        visitId: event.visitId,
        snapshot: { ...event, remuneration },
      },
    });
  }
  async available(patientId: string) {
    return !!(await this.tx.patient.findFirst({
      where: { clinicId: this.clinicId, id: patientId, archived: false },
    }));
  }
}
