import type { InventoryProjection } from "@clinic/contracts";
import type { ClinicTransaction } from "../../database.js";
import { InventoryRepository } from "./inventory.repository.js";
export async function projectInventory(
  tx: ClinicTransaction,
  clinicId: string,
  accountId: string,
  now: () => number,
): Promise<InventoryProjection> {
  return inventoryProjection(
    new InventoryRepository(tx, clinicId, accountId),
    now,
  );
}
export async function inventoryProjection(
  r: InventoryRepository,
  now: () => number,
): Promise<InventoryProjection> {
  // One clinic lock yields a coherent projection across references, settings and batches.
  await r.lock();
  const settings = await r.settings();
  const asOfDate = new Date(now()).toISOString().slice(0, 10);
  const end = new Date(asOfDate + "T00:00:00.000Z");
  end.setUTCDate(end.getUTCDate() + settings.expiryWarningDays);
  const warningEnd = end.toISOString().slice(0, 10);
  const batches = await Promise.all(
    (await r.receipts()).map(async (b) => {
      const stock = await r.stock(b.id, b.quantityPacks);
      const expired = b.expiresOn !== null && b.expiresOn < asOfDate;
      return {
        ...b,
        expired,
        expiring: b.expiresOn !== null && !expired && b.expiresOn <= warningEnd,
        availablePacks: expired ? 0 : stock.balance,
        remainingPacks: stock.balance,
        stockRevision: stock.revision,
      };
    }),
  );
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
    currencies: await r.currencies(),
    asOfDate,
    settings,
    items,
    batches,
    suppliers: await r.suppliers(),
  };
}
