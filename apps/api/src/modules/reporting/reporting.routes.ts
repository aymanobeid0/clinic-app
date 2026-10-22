import { Router } from "express";
import type { ReportingController } from "./reporting.controller.js";
export function reportingRoutes(c: ReportingController) {
  const router = Router();
  router.get("/follow-ups", c.tasks);
  router.post("/follow-ups", c.createTask);
  router.post("/follow-ups/:id", c.updateTask);
  router.get("/follow-ups/:id/history", c.history);
  router.get("/follow-ups/:id/share", c.share);
  router.get("/reports/stock", c.stock);
  router.get("/reports/financial", c.financial);
  router.get("/reports/appointments", c.appointments);
  return router;
}
