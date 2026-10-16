import { Router } from 'express';
import type { ClinicalController } from './clinical.controller.js';
export function clinicalRoutes(c: ClinicalController) {
  const r = Router();
  r.get('/clinical-patients', c.patients);
  r.get('/clinical-events', c.discoveryEvents);
  r.get('/clinical/:id', c.get);
  r.get('/clinical/:id/events', c.events);
  r.post('/clinical/:id/:kind/draft', c.draft);
  r.post('/clinical/:id/:kind/confirm', c.confirm);
  return r;
}
