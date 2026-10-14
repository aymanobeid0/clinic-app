import { Router } from 'express';
import type { PatientController } from './patient.controller.js';
export function patientRoutes(controller: PatientController) {
  const router = Router();
  router.get('/assignment-patients', controller.assignmentSearch);
  router.post('/patients', controller.register);
  router.get('/patients', controller.search);
  router.get('/patients/events', controller.events);
  router.get('/patients/:id', controller.get);
  router.get('/patients/:id/history', controller.history);
  router.post('/patients/:id/contact', controller.contact);
  router.post('/patients/:id/archive', controller.archive);
  router.post('/patients/:id/reactivate', controller.reactivate);
  return router;
}
