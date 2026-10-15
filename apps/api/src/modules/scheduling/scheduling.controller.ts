import type { RequestHandler } from 'express';
import { z } from 'zod';
import {
  bookAppointmentSchema,
  rescheduleAppointmentSchema,
  changeAppointmentStatusSchema,
  schedulingSettingsSchema,
} from '@clinic/contracts';
import type { SchedulingService } from './scheduling.service.js';
import { authorizedEvents } from '../../middleware/authorized-events.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
export class SchedulingController {
  constructor(
    private readonly service: SchedulingService,
    private readonly updates: ClinicUpdates,
    private readonly now: () => number,
  ) {}
  agenda: RequestHandler = async (req, res) => {
    const q = z.object({ date: z.iso.date(), dentistId: z.uuid().optional() }).parse(req.query);
    res.json(await this.service.agenda(req.session.actor, q.date, q.dentistId));
  };
  choices: RequestHandler = async (req, res) => {
    const q = z.object({ q: z.string().trim().max(120).default('') }).parse(req.query);
    res.json(await this.service.choices(req.session.actor, q.q));
  };
  settings: RequestHandler = async (req, res) => {
    res.json(await this.service.settings(req.session.actor));
  };
  changeSettings: RequestHandler = async (req, res) => {
    res.json(
      await this.service.changeSettings(
        req.session.actor,
        schedulingSettingsSchema.parse(req.body),
      ),
    );
  };
  history: RequestHandler = async (req, res) => {
    res.json(await this.service.history(req.session.actor, z.uuid().parse(req.params.id)));
  };
  suggestions: RequestHandler = async (req, res) => {
    res.json(await this.service.suggestions(req.session.actor));
  };
  book: RequestHandler = async (req, res) => {
    res
      .status(201)
      .json(await this.service.book(req.session.actor, bookAppointmentSchema.parse(req.body)));
  };
  reschedule: RequestHandler = async (req, res) => {
    res.json(
      await this.service.reschedule(
        req.session.actor,
        z.uuid().parse(req.params.id),
        rescheduleAppointmentSchema.parse(req.body),
      ),
    );
  };
  status: RequestHandler = async (req, res) => {
    res.json(
      await this.service.status(
        req.session.actor,
        z.uuid().parse(req.params.id),
        changeAppointmentStatusSchema.parse(req.body),
      ),
    );
  };
  events: RequestHandler = (req, res, next) =>
    authorizedEvents(this.service.authorizeStream.bind(this.service), this.updates, this.now)(
      req,
      res,
      next,
    );
}
