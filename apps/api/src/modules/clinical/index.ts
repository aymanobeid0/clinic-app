import { SuggestionService } from "./suggestion.service.js";
import { PrescriptionService } from "./prescription.service.js";
import { Router } from "express";
import { MedicationService } from "./medication.service.js";
import { PrescriptionController } from "./prescription.controller.js";
import { prescriptionRoutes } from "./prescription.routes.js";
import type { IdentityAccess } from "../identity/index.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { ClinicalController } from "./clinical.controller.js";
import { NoteService } from "./note.service.js";
import { ClinicalService } from "./clinical.service.js";
import { clinicalRoutes } from "./clinical.routes.js";
export function createClinicalRoutes(
  identity: IdentityAccess,
  updates: ClinicUpdates,
  now: () => number,
) {
  const r = Router();
  r.use(
    prescriptionRoutes(
      new PrescriptionController(
        new MedicationService(identity, updates),
        new PrescriptionService(identity, updates, now),
        new SuggestionService(identity, updates, now),
        updates,
        now,
      ),
    ),
  );
  r.use(
    clinicalRoutes(
      new ClinicalController(
        new ClinicalService(identity, updates, now),
        new NoteService(identity, updates, now),
        updates,
        now,
      ),
    ),
  );
  return r;
}
