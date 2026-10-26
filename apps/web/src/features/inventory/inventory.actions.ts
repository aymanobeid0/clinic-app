import {
  inventoryItemSchema,
  inventoryItemUpdateSchema,
  inventorySupplierSchema,
  inventorySupplierUpdateSchema,
  inventorySettingsSchema,
  inventoryReceiveSchema,
  inventoryConsumeSchema,
  inventoryCorrectionSchema,
  type Identity,
  type InventoryItem,
  type InventorySupplier,
  type InventorySettings,
  type InventoryReceipt,
  type InventoryMovement,
} from "@clinic/contracts";
import { z } from "zod";
// Transport validation only. Stock, expiry, revisions and permissions remain server rules.
export const inventoryActions = {
  item: {
    schema: inventoryItemSchema.omit({ commandId: true }),
    path: "items",
    permission: "inventory.receive",
  },
  updateItem: {
    schema: inventoryItemUpdateSchema.omit({ commandId: true }),
    path: "items",
    permission: "inventory.receive",
  },
  supplier: {
    schema: inventorySupplierSchema.omit({ commandId: true }),
    path: "suppliers",
    permission: "inventory.receive",
  },
  updateSupplier: {
    schema: inventorySupplierUpdateSchema.omit({ commandId: true }),
    path: "suppliers",
    permission: "inventory.receive",
  },
  settings: {
    schema: inventorySettingsSchema.omit({ commandId: true }),
    path: "settings",
    permission: "manager",
  },
  receive: {
    schema: inventoryReceiveSchema.omit({ commandId: true }),
    path: "receiving",
    permission: "inventory.receive",
  },
  consume: {
    schema: inventoryConsumeSchema.omit({ commandId: true }),
    path: "consume",
    permission: "inventory.consume",
  },
  correction: {
    schema: z.discriminatedUnion("kind", [
      inventoryCorrectionSchema.options[0].omit({ commandId: true }),
      inventoryCorrectionSchema.options[1].omit({ commandId: true }),
      inventoryCorrectionSchema.options[2].omit({ commandId: true }),
    ]),
    path: "corrections",
    permission: "inventory.adjust",
  },
} as const;
export type InventoryAction = keyof typeof inventoryActions;
export type InventoryResults = {
  item: InventoryItem;
  updateItem: InventoryItem;
  supplier: InventorySupplier;
  updateSupplier: InventorySupplier;
  settings: InventorySettings;
  receive: InventoryReceipt;
  consume: InventoryMovement;
  correction: InventoryMovement;
};
export const inventoryKey = (account: string) => ["inventory", account];
export function inventoryAllowed(
  identity: Identity,
  permission: Identity["permissions"][number] | "manager",
) {
  return (
    identity.stage === "ready" &&
    !identity.historicalOnly &&
    (permission === "manager"
      ? identity.isManager
      : identity.permissions.includes(permission))
  );
}
