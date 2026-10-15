import { Router } from 'express';
import type { SchedulingController } from './scheduling.controller.js';
export function schedulingRoutes(c: SchedulingController) {
  const r = Router();
  r.get('/appointments', c.agenda);
  r.post('/appointments', c.book);
  r.get('/appointments/choices', c.choices);
  r.get('/appointments/settings', c.settings);
  r.post('/appointments/settings', c.changeSettings);
  r.get('/appointments/suggestions', c.suggestions);
  r.get('/appointments/events', c.events);
  r.get('/appointments/:id/history', c.history);
  r.post('/appointments/:id/reschedule', c.reschedule);
  r.post('/appointments/:id/status', c.status);
  return r;
}
