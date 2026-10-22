import type { z } from "zod";
import type {
  inventoryItemSchema,
  inventoryItemUpdateSchema,
  inventorySupplierSchema,
  inventorySupplierUpdateSchema,
  inventorySettingsSchema,
  inventoryReceiveSchema,
  InventoryProjection,
} from "@clinic/contracts";
import type { Actor, IdentityAccess } from "../identity/index.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { AppError } from "../../errors/app-error.js";
import { InventoryRepository } from "./inventory.repository.js";
export class InventoryService {
  constructor(
    private readonly identity: IdentityAccess,
    private readonly updates: ClinicUpdates,
    private readonly now: () => number,
  ) {}
  private run<T>(
    actor: Actor | undefined,
    action: (r: InventoryRepository) => Promise<T>,
  ) {
    return this.identity.withPermission(actor, "inventory.read", (c, tx) =>
      action(new InventoryRepository(tx, c.clinicId, c.accountId)),
    );
  }
  authorize(actor: Actor | undefined) {
    return this.identity.withPermission(
      actor,
      "inventory.read",
      async (c) => c.clinicId,
    );
  }
  history(actor: Actor | undefined) {
    return this.run(actor, async (r) => ({ receipts: await r.receipts() }));
  }
  settings(actor: Actor | undefined) {
    return this.run(actor, (r) => r.settings());
  }
  projection(actor: Actor | undefined): Promise<InventoryProjection> {
    return this.run(actor, async (r) => {
      // One clinic lock yields a coherent projection across references, settings and batches.
      await r.lock();
      const settings = await r.settings();
      const asOfDate = new Date(this.now()).toISOString().slice(0, 10);
      const end = new Date(asOfDate + "T00:00:00.000Z");
      end.setUTCDate(end.getUTCDate() + settings.expiryWarningDays);
      const warningEnd = end.toISOString().slice(0, 10);
      const batches = (await r.receipts()).map((b) => {
        const expired = b.expiresOn !== null && b.expiresOn < asOfDate;
        return {
          ...b,
          expired,
          expiring:
            b.expiresOn !== null && !expired && b.expiresOn <= warningEnd,
          availablePacks: expired ? 0 : b.quantityPacks,
        };
      });
      const items = (await r.items()).map((i) => {
        const availablePacks = batches
          .filter((b) => b.itemId === i.id)
          .reduce((sum, b) => sum + b.availablePacks, 0);
        return {
          ...i,
          availablePacks,
          lowStock: availablePacks <= i.lowStockThreshold,
        };
      });
      return {
        asOfDate,
        settings,
        items,
        batches,
        suppliers: await r.suppliers(),
      };
    });
  }
  private async mutate<T>(
    actor: Actor | undefined,
    commandId: string,
    payload: unknown,
    manager: boolean,
    action: (r: InventoryRepository) => Promise<T>,
  ): Promise<T> {
    const perform = async (
      c: { clinicId: string; accountId: string },
      tx: import("../../database.js").ClinicTransaction,
    ) => {
      const r = new InventoryRepository(tx, c.clinicId, c.accountId);
      await r.lock();
      const replay = await r.replay(commandId, payload);
      if (replay.previous !== undefined)
        return { clinicId: c.clinicId, value: replay.previous as T };
      const value = await action(r);
      await r.save(commandId, replay.hash, value);
      return { clinicId: c.clinicId, value };
    };
    const result = manager
      ? await this.identity.withManager(actor, perform)
      : await this.identity.withPermission(actor, "inventory.receive", perform);
    this.updates.publish(result.clinicId, "inventory");
    return result.value;
  }
  item(
    actor: Actor | undefined,
    data:
      | z.infer<typeof inventoryItemSchema>
      | z.infer<typeof inventoryItemUpdateSchema>,
    id?: string,
  ) {
    return this.mutate(
      actor,
      data.commandId,
      ["item", id ?? null, data],
      false,
      async (r) => {
        if (id) {
          const old = await r.item(id);
          this.checkRevision(
            old.revision,
            "revision" in data ? data.revision : -1,
          );
          if (
            old.expiryRequired !== data.expiryRequired &&
            (await r.hasBatches(id))
          )
            throw new AppError(
              409,
              "La règle de péremption est fixée après réception.",
            );
        }
        return r.writeItem(
          {
            name: data.name,
            active: data.active,
            lowStockThreshold: data.lowStockThreshold,
            expiryRequired: data.expiryRequired,
          },
          id,
        );
      },
    );
  }
  supplier(
    actor: Actor | undefined,
    data:
      | z.infer<typeof inventorySupplierSchema>
      | z.infer<typeof inventorySupplierUpdateSchema>,
    id?: string,
  ) {
    return this.mutate(
      actor,
      data.commandId,
      ["supplier", id ?? null, data],
      false,
      async (r) => {
        if (id)
          this.checkRevision(
            (await r.supplier(id)).revision,
            "revision" in data ? data.revision : -1,
          );
        return r.writeSupplier({ name: data.name, active: data.active }, id);
      },
    );
  }
  changeSettings(
    actor: Actor | undefined,
    data: z.infer<typeof inventorySettingsSchema>,
  ) {
    return this.mutate(
      actor,
      data.commandId,
      ["settings", data],
      true,
      async (r) => {
        this.checkRevision((await r.settings()).revision, data.revision);
        return r.writeSettings(data.expiryWarningDays);
      },
    );
  }
  receive(
    actor: Actor | undefined,
    data: z.infer<typeof inventoryReceiveSchema>,
  ) {
    return this.mutate(
      actor,
      data.commandId,
      ["receive", data],
      false,
      async (r) => {
        if (!(await r.currency(data.currency)))
          throw new AppError(400, "Devise non activée par le responsable.");
        const item = await r.item(data.itemId),
          supplier = await r.supplier(data.supplierId);
        if (!item.active || !supplier.active)
          throw new AppError(409, "Article ou fournisseur inactif.");
        if (item.expiryRequired && data.expiresOn === null)
          throw new AppError(400, "Date de péremption requise.");
        if (await r.duplicate(data.itemId, data.supplierId, data.batchNumber))
          throw new AppError(
            409,
            "Lot déjà reçu pour cet article et ce fournisseur.",
          );
        const batch = {
          itemId: data.itemId,
          supplierId: data.supplierId,
          batchNumber: data.batchNumber,
          quantityPacks: data.quantityPacks,
          totalCostMinor: data.totalCostMinor,
          currency: data.currency,
          expiresOn: data.expiresOn,
        };
        return r.receive({
          ...batch,
          itemName: item.name,
          supplierName: supplier.name,
          receivedAt: new Date(this.now()).toISOString(),
        });
      },
    );
  }
  private checkRevision(actual: number, expected: number) {
    if (actual !== expected)
      throw new AppError(
        409,
        "Cet enregistrement a changé. Rechargez et réconciliez votre saisie.",
      );
  }
}
