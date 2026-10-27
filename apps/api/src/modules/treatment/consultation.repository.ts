import type {
  ConsultationRecord,
  ConsultationPrice,
  Remuneration,
} from "@clinic/contracts";
import type { ClinicTransaction } from "../../database.js";

export class ConsultationRepository {
  constructor(
    readonly tx: ClinicTransaction,
    readonly clinicId: string,
  ) {}
  async versions(
    patientId?: string,
    id?: string,
  ): Promise<ConsultationRecord[]> {
    const rows = await this.tx.consultationRevision.findMany({
      where: {
        clinicId: this.clinicId,
        ...(patientId ? { patientId } : {}),
        ...(id ? { id } : {}),
      },
      orderBy: { revision: "asc" },
    });
    return rows.map((r) => r.snapshot as unknown as ConsultationRecord);
  }
  async current(patientId?: string) {
    return [
      ...new Map(
        (await this.versions(patientId)).map((v) => [v.id, v]),
      ).values(),
    ];
  }
  async append(value: ConsultationRecord) {
    await this.tx.consultationRevision.create({
      data: {
        clinicId: this.clinicId,
        id: value.id,
        patientId: value.patientId,
        doctorId: value.doctorId,
        revision: value.revision,
        snapshot: value,
      },
    });
  }
  async settings(key: string): Promise<(ConsultationPrice | Remuneration)[]> {
    return (
      await this.tx.consultationSetting.findMany({
        where: { clinicId: this.clinicId, key },
        orderBy: { revision: "asc" },
      })
    ).map((r) => r.snapshot as unknown as ConsultationPrice | Remuneration);
  }
  async price() {
    return (await this.settings("price")).at(-1) as
      ConsultationPrice | undefined;
  }
  async remuneration(doctorId: string) {
    return (await this.settings(doctorId)).at(-1) as Remuneration | undefined;
  }
  async setting(key: string, value: ConsultationPrice | Remuneration) {
    await this.tx.consultationSetting.create({
      data: {
        clinicId: this.clinicId,
        key,
        revision: value.revision,
        snapshot: value,
      },
    });
  }
}
