import { z } from "zod";
const id = z.uuid().transform((v) => v.toLowerCase());
const revision = z.number().int().nonnegative().max(2147483646);
const name = z.string().trim().min(1).max(200);
const packs = z.number().int().nonnegative().max(1000000000);
export const inventorySupplierSchema = z
  .object({ commandId: id, name, active: z.boolean() })
  .strict();
export const inventorySupplierUpdateSchema = inventorySupplierSchema.extend({
  revision,
});
export const inventoryItemSchema = inventorySupplierSchema.extend({
  lowStockThreshold: packs,
  expiryRequired: z.boolean(),
});
export const inventoryItemUpdateSchema = inventoryItemSchema.extend({
  revision,
});
export const inventorySettingsSchema = z
  .object({
    commandId: id,
    revision,
    expiryWarningDays: z.number().int().min(0).max(3650),
  })
  .strict();
export const inventoryReceiveSchema = z
  .object({
    commandId: id,
    itemId: id,
    supplierId: id,
    batchNumber: z.string().trim().min(1).max(100),
    quantityPacks: packs.refine((n) => n > 0),
    totalCostMinor: z.string().regex(/^(0|[1-9][0-9]{0,14})$/),
    currency: z.enum(["MRU", "EUR", "USD", "JPY", "KWD"]),
    expiresOn: z.iso
      .date()
      .refine((v) => v >= "1900-01-01" && v <= "9999-12-31")
      .nullable(),
  })
  .strict();
export type InventorySupplier = {
  id: string;
  revision: number;
  name: string;
  active: boolean;
};
export type InventoryItem = InventorySupplier & {
  lowStockThreshold: number;
  expiryRequired: boolean;
};
export type InventorySettings = { revision: number; expiryWarningDays: number };
export type InventoryReceipt = {
  id: string;
  itemId: string;
  supplierId: string;
  itemName: string;
  supplierName: string;
  batchNumber: string;
  quantityPacks: number;
  totalCostMinor: string;
  currency: string;
  expiresOn: string | null;
  receivedAt: string;
  actorId: string;
};
export type InventoryProjection = {
  currencies: { code: string; precision: number }[];
  asOfDate: string;
  settings: InventorySettings;
  suppliers: InventorySupplier[];
  items: (InventoryItem & { availablePacks: number; lowStock: boolean })[];
  batches: (InventoryReceipt & {
    availablePacks: number;
    expired: boolean;
    expiring: boolean;
  })[];
};
