import type { RequestHandler } from 'express';
import { z } from 'zod';
import {
  treatmentPlanSchema,
  catalogCommandSchema,
  enableCurrencySchema,
} from '@clinic/contracts';
import { authorizedEvents } from '../../middleware/authorized-events.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import type { TreatmentService } from './treatment.service.js';
export class TreatmentController {
  constructor(
    readonly service: TreatmentService,
    readonly updates: ClinicUpdates,
    readonly now: () => number,
  ) {}
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
