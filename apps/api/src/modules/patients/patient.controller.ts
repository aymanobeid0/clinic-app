import type { RequestHandler } from 'express';
import { registerPatientSchema, editPatientSchema, patientMutationSchema } from '@clinic/contracts';
import { z } from 'zod';
import type { PatientService } from './patient.service.js';
import type { PatientUpdates } from './patient.updates.js';
import { authorizedEvents } from '../../middleware/authorized-events.js';
export class PatientController {
  assignmentSearch: RequestHandler = async (req, res) => {
    const q = z
      .object({
        q: z.string().trim().max(120).default(''),
        archived: z.enum(['true', 'false']).default('false'),
        offset: z.coerce.number().int().min(0).max(2147483647).default(0),
      })
      .parse(req.query);
    res.json(
      await this.service.assignmentSearch(req.session.actor, q.q, q.archived === 'true', q.offset),
    );
  };
  constructor(
    private readonly service: PatientService,
    private readonly updates: PatientUpdates,
    private readonly now: () => number,
  ) {}
  events: RequestHandler = (req, res, next) =>
    authorizedEvents(this.service.authorizeStream.bind(this.service), this.updates, this.now)(
      req,
      res,
      next,
    );
  register: RequestHandler = async (req, res) => {
    res
      .status(201)
      .json(await this.service.register(req.session.actor, registerPatientSchema.parse(req.body)));
  };
  get: RequestHandler = async (req, res) => {
    res.json(await this.service.get(req.session.actor, z.uuid().parse(req.params.id)));
  };
  history: RequestHandler = async (req, res) => {
    res.json(await this.service.history(req.session.actor, z.uuid().parse(req.params.id)));
  };
  contact: RequestHandler = async (req, res) => {
    const data = editPatientSchema.parse(req.body);
    res.json(
      await this.service.change(
        req.session.actor,
        z.uuid().parse(req.params.id),
        data,
        'contact',
        data,
      ),
    );
  };
  archive: RequestHandler = async (req, res) => {
    res.json(
      await this.service.change(
        req.session.actor,
        z.uuid().parse(req.params.id),
        patientMutationSchema.parse(req.body),
        'archived',
      ),
    );
  };
  reactivate: RequestHandler = async (req, res) => {
    res.json(
      await this.service.change(
        req.session.actor,
        z.uuid().parse(req.params.id),
        patientMutationSchema.parse(req.body),
        'reactivated',
      ),
    );
  };
  search: RequestHandler = async (req, res) => {
    const query = z
      .object({
        q: z.string().trim().max(120).default(''),
        archived: z.enum(['true', 'false']).default('false'),
        offset: z.coerce.number().int().min(0).max(2147483647).default(0),
      })
      .parse(req.query);
    res.json(
      await this.service.search(
        req.session.actor,
        query.q,
        query.archived === 'true',
        query.offset,
      ),
    );
  };
}
