import type { VisitService } from './visit.service.js';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import {
  startVisitSchema,
  visitActionSchema,
  treatmentPlanSchema,
  planLifecycleSchema,
  catalogCommandSchema,
  enableCurrencySchema,
} from '@clinic/contracts';
import { authorizedEvents } from '../../middleware/authorized-events.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import type { TreatmentService } from './treatment.service.js';
export class TreatmentController {
  constructor(
    readonly service: TreatmentService,
    readonly visits: VisitService,
    readonly updates: ClinicUpdates,
    readonly now: () => number,
  ) {}
  visitAction: RequestHandler = async (req, res) => {
    res.json(
      await this.visits.action(
        req.session.actor,
        z.uuid().parse(req.params.id),
        visitActionSchema.parse(req.body),
      ),
    );
  };
  visitState: RequestHandler = async (req, res) => {
    res.json(
      await this.visits.state(req.session.actor, z.uuid().parse(req.params.id)),
    );
  };
  startVisit: RequestHandler = async (req, res) => {
    res.json(
      await this.visits.start(
        req.session.actor,
        z.uuid().parse(req.params.id),
        startVisitSchema.parse(req.body),
      ),
    );
  };
  plans: RequestHandler = async (req, res) => {
    res.json(
      await this.service.plans(
        req.session.actor,
        z.uuid().parse(req.params.id),
      ),
    );
  };
  savePlan: RequestHandler = async (req, res) => {
    res.json(
      await this.service.savePlan(
        req.session.actor,
        z.uuid().parse(req.params.id),
        treatmentPlanSchema.parse(req.body),
      ),
    );
  };
  print: RequestHandler = async (req, res) => {
    res.json(
      await this.service.printable(
        req.session.actor,
        z.uuid().parse(req.params.id),
        z.uuid().parse(req.params.planId),
        z.coerce.number().int().positive().parse(req.params.revision),
      ),
    );
  };
  lifecycle: RequestHandler = async (req, res) => {
    res.json(
      await this.service.lifecycle(
        req.session.actor,
        z.uuid().parse(req.params.id),
        planLifecycleSchema.parse(req.body),
      ),
    );
  };
  planEvents: RequestHandler = (req, res, next) =>
    authorizedEvents(
      (a) => this.service.authorizePlan(a, z.uuid().parse(req.params.id)),
      this.updates,
      this.now,
    )(req, res, next);
  catalog: RequestHandler = async (req, res) => {
    res.json(await this.service.catalog(req.session.actor));
  };
  currencies: RequestHandler = async (req, res) => {
    res.json(await this.service.currencies(req.session.actor));
  };
  enable: RequestHandler = async (req, res) => {
    res.json(
      await this.service.enable(
        req.session.actor,
        enableCurrencySchema.parse(req.body),
      ),
    );
  };
  put: RequestHandler = async (req, res) => {
    res.json(
      await this.service.put(
        req.session.actor,
        catalogCommandSchema.parse(req.body),
      ),
    );
  };
  currencyEvents: RequestHandler = (req, res, next) =>
    authorizedEvents(
      this.service.authorizeCurrencies.bind(this.service),
      this.updates,
      this.now,
    )(req, res, next);
  events: RequestHandler = (req, res, next) =>
    authorizedEvents(
      this.service.authorize.bind(this.service),
      this.updates,
      this.now,
    )(req, res, next);
}
