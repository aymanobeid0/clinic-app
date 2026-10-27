import { Router } from "express";
import type { ConsultationController } from "./consultation.controller.js";
export function consultationRoutes(c: ConsultationController) {
  const r = Router();
  r.get("/consultation-settings/price", c.price);
  r.post("/consultation-settings/price", c.setPrice);
  r.post("/consultation-settings/remuneration", c.setRemuneration);
  r.get("/consultation-settings/remuneration/:doctorId", c.remunerationHistory);
  r.get("/consultations", c.day);
  r.get("/consultations/:patientId", c.patient);
  r.post("/consultations/:patientId", c.book);
  r.post("/consultations/:patientId/entry", c.enter);
  r.post("/consultations/:patientId/complete", c.complete);
  r.get("/consultations/:patientId/:consultationId/remuneration", c.frozen);
  return r;
}
