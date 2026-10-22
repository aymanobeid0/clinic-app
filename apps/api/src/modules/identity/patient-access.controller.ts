import { authorizedEvents } from '../../middleware/authorized-events.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import type { RequestHandler } from 'express';
import { sharePatientSchema, removePatientAccessSchema, historicalGrantSchema, revokePatientSchema } from '@clinic/contracts';
import { z } from 'zod';
import type { PatientAccessService } from './patient-access.service.js';
export class PatientAccessController {
  historical: RequestHandler = async (req,res) => {
    res.json(await this.service.change(req.session.actor,z.uuid().parse(req.params.id),historicalGrantSchema.parse(req.body),'historical'));
  };
  revoke: RequestHandler = async (req,res) => {
    res.json(await this.service.change(req.session.actor,z.uuid().parse(req.params.id),revokePatientSchema.parse(req.body),'revoke'));
  };
  constructor(
    private readonly service: PatientAccessService,
    private readonly updates: ClinicUpdates,
    private readonly now: () => number,
  ) {}
  events: RequestHandler = (req, res, next) =>
    authorizedEvents(this.service.authorizeStream.bind(this.service), this.updates, this.now)(
      req,
      res,
      next,
    );
  candidates: RequestHandler = async (req, res) => {
    res.json(await this.service.candidates(req.session.actor));
  };
  get: RequestHandler = async (req, res) => {
    res.json(await this.service.get(req.session.actor, z.uuid().parse(req.params.id)));
  };
  history: RequestHandler = async (req, res) => {
    res.json(await this.service.history(req.session.actor, z.uuid().parse(req.params.id)));
  };
  share: RequestHandler = async (req, res) => {
    res.json(
      await this.service.change(
        req.session.actor,
        z.uuid().parse(req.params.id),
        sharePatientSchema.parse(req.body),
        'share',
      ),
    );
  };
  remove: RequestHandler = async (req, res) => {
    res.json(
      await this.service.change(
        req.session.actor,
        z.uuid().parse(req.params.id),
        removePatientAccessSchema.parse(req.body),
        'remove',
      ),
    );
  };
}
