import type { ClinicTransaction } from "../../database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../errors/app-error.js";
export class ExportsRepository {
  constructor(
    readonly tx: ClinicTransaction,
    readonly clinicId: string,
    readonly accountId: string,
  ) {}
  find(id: string) {
    return this.tx.exportArtifact.findFirst({
      where: { clinicId: this.clinicId, accountId: this.accountId, id },
    });
  }
  cleanup(now: Date) {
    return this.tx.exportArtifact.deleteMany({
      where: { clinicId: this.clinicId, expiresAt: { lte: now } },
    });
  }
  save(data: Prisma.ExportArtifactUncheckedCreateInput) {
    return this.tx.exportArtifact.create({ data });
  }
  async capacity(size: number) {
    const [usage] = await this.tx.$queryRaw<
      { bytes: bigint; count: bigint }[]
    >`SELECT coalesce(sum(octet_length(bytes)),0)::bigint AS bytes,count(*)::bigint AS count FROM "ExportArtifact" WHERE "clinicId"=${this.clinicId}::uuid`;
    if (
      !usage ||
      usage.count >= 20n ||
      usage.bytes + BigInt(size) > 100_000_000n
    )
      throw new AppError(
        409,
        "Stockage temporaire des exports occupé. Réessayez après expiration.",
      );
  }
}
