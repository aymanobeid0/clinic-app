import type { RequestHandler } from "express";
import { z } from "zod";
import { openingBalanceSchema, reconcileChargeSchema } from "@clinic/contracts";
import type { BillingService } from "./billing.service.js";
const patientId = (value: unknown) => z.uuid().parse(value).toLowerCase();
export class BillingController {
  constructor(readonly service: BillingService) {}
  state: RequestHandler = async (req, res) => {
    res.json(
      await this.service.state(req.session.actor, patientId(req.params.id)),
    );
  };
  opening: RequestHandler = async (req, res) => {
    res.json(
      await this.service.opening(
        req.session.actor,
        patientId(req.params.id),
        openingBalanceSchema.parse(req.body),
      ),
    );
  };
  reconcile: RequestHandler = async (req, res) => {
    res.json(
      await this.service.reconcile(
        req.session.actor,
        patientId(req.params.id),
        reconcileChargeSchema.parse(req.body),
      ),
    );
  };
}
