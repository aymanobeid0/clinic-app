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

export { projectInventory as reportInventory } from './inventory.projection.js';
export async function exportInventory(tx:import('../../database.js').ClinicTransaction,clinicId:string,accountId:string,now:()=>number) {
  const {projectInventory}=await import('./inventory.projection.js');
  const {InventoryRepository}=await import('./inventory.repository.js');
  const state=await projectInventory(tx,clinicId,accountId,now);
  const repository=new InventoryRepository(tx,clinicId,accountId);
  return {...state,movements:(await Promise.all(state.batches.map(b=>repository.movements(b.id)))).flat()};
}
export {assertExportBound as boundInventoryExport} from './export-bounds.repository.js';
