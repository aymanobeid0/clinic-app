import { Router } from "express";
import type { BillingController } from "./billing.controller.js";
export function billingRoutes(c: BillingController) {
  const router = Router();
  router.get("/billing/payment-methods", c.methods);
  router.post("/billing/:id/invoices", c.issue);
  router.get("/billing/:id/plans/:planId/summary", c.summary);
  router.get("/billing/:id/plans/:planId/summary/:action", c.summary);
  router.get("/billing/:id/invoices", c.invoices);
  router.get("/billing/:id/invoices/:invoiceId", c.invoices);
  router.get("/billing/:id/invoices/:invoiceId/:action", c.invoices);
  router.post("/billing/payment-methods", c.method);
  router.post("/billing/:id/settlements", c.settle);
  router.get("/billing/:id/settlements/:settlementId", c.settlement);
  router.get("/billing/:id/settlements/:settlementId/:action", c.output);
  router.get("/billing/:id", c.state);
  router.post("/billing/:id/opening-balances", c.opening);
  router.post("/billing/:id/reconcile", c.reconcile);
  return router;
}
