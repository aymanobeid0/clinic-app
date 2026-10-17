import { Router } from 'express';
import type { TreatmentController } from './treatment.controller.js';
export function treatmentRoutes(c: TreatmentController) {
  const r = Router();
  r.get('/treatment/:id/visits', c.visitState);
  r.post('/treatment/:id/visits', c.startVisit);
  r.post('/treatment/:id/visits/actions', c.visitAction);
  r.get('/treatment/:id/plans', c.plans);
  r.post('/treatment/:id/plans', c.savePlan);
  r.post('/treatment/:id/plans/lifecycle', c.lifecycle);
  r.get('/treatment/:id/plans/:planId/versions/:revision/print', c.print);
  r.get('/treatment/:id/events', c.planEvents);
  r.get('/catalog', c.catalog);
  r.get('/catalog/events', c.events);
  r.post('/catalog', c.put);
  r.get('/catalog/currencies', c.currencies);
  r.get('/catalog/currencies/events', c.currencyEvents);
  r.post('/catalog/currencies', c.enable);
  return r;
}
