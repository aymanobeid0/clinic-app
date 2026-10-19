import { Router } from "express";
import type { BillingController } from "./billing.controller.js";
export function billingRoutes(c: BillingController) {
  const router = Router();
  router.get("/billing/:id", c.state);
  router.post("/billing/:id/opening-balances", c.opening);
  router.post("/billing/:id/reconcile", c.reconcile);
  return router;
}
