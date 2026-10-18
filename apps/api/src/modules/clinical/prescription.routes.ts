import { Router } from "express";
import type { PrescriptionController } from "./prescription.controller.js";
export function prescriptionRoutes(c: PrescriptionController) {
  const r = Router();
  r.get("/clinical/:patientId/suggestions", c.suggestionsList);
  r.post("/clinical/:patientId/suggestions/:suggestionId", c.suggestionChange);
  r.get("/clinical/:patientId/prescriptions", c.prescriptionsList);
  r.get("/clinical/:patientId/prescriptions/:prescriptionId", c.prescription);
  r.get(
    "/clinical/:patientId/prescriptions/:prescriptionId/print/:revision",
    c.print,
  );
  r.post(
    "/clinical/:patientId/prescriptions/:prescriptionId/:action",
    c.change,
  );
  r.get("/medications/events", c.events);
  r.get("/medications", c.list);
  r.post("/medications", c.save);
  r.get("/prescription-template", c.template);
  r.post("/prescription-template", c.saveTemplate);
  return r;
}
