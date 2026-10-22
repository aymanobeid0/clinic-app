import type { IdentityAccess } from "../identity/index.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { InventoryService } from "./inventory.service.js";
import { InventoryController } from "./inventory.controller.js";
import { inventoryRoutes } from "./inventory.routes.js";
export function createInventoryRoutes(
  identity: IdentityAccess,
  updates: ClinicUpdates,
  now: () => number,
) {
  return inventoryRoutes(
    new InventoryController(
      new InventoryService(identity, updates, now),
      updates,
      now,
    ),
  );
}
