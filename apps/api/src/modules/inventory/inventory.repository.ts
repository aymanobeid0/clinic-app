import { enabledClinicCurrency } from "../treatment/index.js";
import { createHash, randomUUID } from "node:crypto";
import type {
  InventoryReceipt,
  InventoryItem,
  InventorySupplier,
  InventorySettings,
} from "@clinic/contracts";
import type { ClinicTransaction } from "../../database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../errors/app-error.js";
const itemFields = {
  id: true,
  revision: true,
  name: true,
  active: true,
  lowStockThreshold: true,
  expiryRequired: true,
} as const;
const supplierFields = {
  id: true,
  revision: true,
  name: true,
  active: true,
} as const;
const batchFields = {
  id: true,
  itemId: true,
  supplierId: true,
  itemName: true,
  supplierName: true,
  batchNumber: true,
  quantityPacks: true,
  totalCostMinor: true,
  currency: true,
  expiresOn: true,
  receivedAt: true,
  actorId: true,
} as const;
export class InventoryRepository {
  constructor(
    private readonly tx: ClinicTransaction,
    private readonly clinicId: string,
    private readonly actorId: string,
  ) {}

  currency(code: string) {
    return enabledClinicCurrency(this.tx, this.clinicId, code);
  }
  // Serialize inventory mutations within this clinic, including retries and reference edits.
  async lock() {
    await this.tx
      .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.clinicId + ":inventory"},0))::text`;
  }
  async replay(commandId: string, payload: unknown) {
    const hash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    const old = await this.tx.inventoryCommand.findUnique({
      where: { clinicId_commandId: { clinicId: this.clinicId, commandId } },
    });
    if (old && (old.actorId !== this.actorId || old.payloadHash !== hash))
      throw new AppError(409, "Commande déjà utilisée.");
    return { hash, previous: old?.receipt };
  }
  async save(commandId: string, hash: string, value: unknown) {
    await this.tx.inventoryCommand.create({
      data: {
        clinicId: this.clinicId,
        commandId,
        actorId: this.actorId,
        payloadHash: hash,
        receipt: JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue,
      },
    });
  }
  items(): Promise<InventoryItem[]> {
    return this.tx.inventoryItem.findMany({
      select: itemFields,
      where: { clinicId: this.clinicId },
      orderBy: { id: "asc" },
    });
  }
  suppliers(): Promise<InventorySupplier[]> {
    return this.tx.inventorySupplier.findMany({
      select: supplierFields,
      where: { clinicId: this.clinicId },
      orderBy: { id: "asc" },
    });
  }
  async item(id: string) {
    const row = await this.tx.inventoryItem.findFirst({
      where: { clinicId: this.clinicId, id },
    });
    if (!row) throw new AppError(404, "Article introuvable.");
    return row;
  }
  async supplier(id: string) {
    const row = await this.tx.inventorySupplier.findFirst({
      where: { clinicId: this.clinicId, id },
    });
    if (!row) throw new AppError(404, "Fournisseur introuvable.");
    return row;
  }
  async hasBatches(itemId: string) {
    return !!(await this.tx.inventoryBatch.findFirst({
      where: { clinicId: this.clinicId, itemId },
    }));
  }
  async duplicate(itemId: string, supplierId: string, batchNumber: string) {
    return !!(await this.tx.inventoryBatch.findFirst({
      where: { clinicId: this.clinicId, itemId, supplierId, batchNumber },
    }));
  }
  async settings(): Promise<InventorySettings> {
    return (
      (await this.tx.inventorySettings.findUnique({
        where: { clinicId: this.clinicId },
        select: { revision: true, expiryWarningDays: true },
      })) ?? { revision: 0, expiryWarningDays: 30 }
    );
  }
  async writeItem(data: Omit<InventoryItem, "id" | "revision">, id?: string) {
    return id
      ? this.tx.inventoryItem.update({
          select: itemFields,
          where: { clinicId_id: { clinicId: this.clinicId, id } },
          data: { ...data, revision: { increment: 1 } },
        })
      : this.tx.inventoryItem.create({
          select: itemFields,
          data: { ...data, id: randomUUID(), clinicId: this.clinicId },
        });
  }
  async writeSupplier(
    data: Pick<InventorySupplier, "name" | "active">,
    id?: string,
  ) {
    return id
      ? this.tx.inventorySupplier.update({
          select: supplierFields,
          where: { clinicId_id: { clinicId: this.clinicId, id } },
          data: { ...data, revision: { increment: 1 } },
        })
      : this.tx.inventorySupplier.create({
          select: supplierFields,
          data: { ...data, id: randomUUID(), clinicId: this.clinicId },
        });
  }
  async writeSettings(expiryWarningDays: number) {
    const row = await this.tx.inventorySettings.upsert({
      where: { clinicId: this.clinicId },
      create: { clinicId: this.clinicId, revision: 1, expiryWarningDays },
      update: { revision: { increment: 1 }, expiryWarningDays },
    });
    return { revision: row.revision, expiryWarningDays: row.expiryWarningDays };
  }
  async receive(
    data: Omit<InventoryReceipt, "id" | "actorId">,
  ): Promise<InventoryReceipt> {
    const row = await this.tx.inventoryBatch.create({
      select: batchFields,
      data: {
        ...data,
        id: randomUUID(),
        clinicId: this.clinicId,
        actorId: this.actorId,
        totalCostMinor: BigInt(data.totalCostMinor),
        receivedAt: new Date(data.receivedAt),
      },
    });
    return {
      ...row,
      totalCostMinor: row.totalCostMinor.toString(),
      receivedAt: row.receivedAt.toISOString(),
    };
  }
  async receipts(): Promise<InventoryReceipt[]> {
    return (
      await this.tx.inventoryBatch.findMany({
        select: batchFields,
        where: { clinicId: this.clinicId },
        orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      })
    ).map((row) => ({
      ...row,
      totalCostMinor: row.totalCostMinor.toString(),
      receivedAt: row.receivedAt.toISOString(),
    }));
  }
}
