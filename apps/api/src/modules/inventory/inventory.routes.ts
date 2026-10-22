import { Router } from "express";
import type { InventoryController } from "./inventory.controller.js";
export function inventoryRoutes(c: InventoryController) {
  const r = Router();
  r.get("/inventory", c.projection);
  r.get("/inventory/receiving", c.history);
  r.get("/inventory/settings", c.settings);
  r.get("/inventory/events", c.events);
  r.post("/inventory/items", c.item);
  r.post("/inventory/items/:id", c.updateItem);
  r.post("/inventory/suppliers", c.supplier);
  r.post("/inventory/suppliers/:id", c.updateSupplier);
  r.post("/inventory/receiving", c.receive);
  r.post("/inventory/settings", c.changeSettings);
  return r;
}
