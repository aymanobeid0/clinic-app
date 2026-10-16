import { authorizedEvents } from '../../middleware/authorized-events.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import {
  clinicalDraftSchema,
  clinicalConfirmSchema,
  chartDraftSchema,
} from '@clinic/contracts';
import type { ClinicalService } from './clinical.service.js';
export class ClinicalController {
  constructor(
    private readonly service: ClinicalService,
    private readonly updates: ClinicUpdates,
    private readonly now: () => number,
  ) {}
  patients: RequestHandler = async (req, res) => {
    res.json(await this.service.patients(req.session.actor));
  };
  discoveryEvents: RequestHandler = (req, res, next) =>
    authorizedEvents(
      this.service.authorizeDiscovery.bind(this.service),
      this.updates,
      this.now,
    )(req, res, next);
  events: RequestHandler = (req, res, next) =>
    authorizedEvents(
      (a) => this.service.authorizeStream(a, z.uuid().parse(req.params.id)),
      this.updates,
      this.now,
    )(req, res, next);
  get: RequestHandler = async (req, res) => {
    res.json(
      await this.service.get(req.session.actor, z.uuid().parse(req.params.id)),
    );
  };
  draft: RequestHandler = async (req, res) => {
    res.json(
      await this.service.change(
        req.session.actor,
        z.uuid().parse(req.params.id),
        z.enum(['history', 'chart']).parse(req.params.kind),
        'draft',
        (req.params.kind === 'chart'
          ? chartDraftSchema
          : clinicalDraftSchema
        ).parse(req.body),
      ),
    );
  };
  confirm: RequestHandler = async (req, res) => {
    res.json(
      await this.service.change(
        req.session.actor,
        z.uuid().parse(req.params.id),
        z.enum(['history', 'chart']).parse(req.params.kind),
        'confirm',
        clinicalConfirmSchema.parse(req.body),
      ),
    );
  };
}
