import type { RequestHandler } from "express";
import { z } from "zod";
import {
  openingBalanceSchema,
  reconcileChargeSchema,
  paymentMethodSchema,
  settlementSchema,
} from "@clinic/contracts";
import type { BillingService } from "./billing.service.js";
const patientId = (value: unknown) => z.uuid().parse(value).toLowerCase();
export class BillingController {
  constructor(readonly service: BillingService) {}
  output: RequestHandler = async (req, res) => {
    res.json(
      await this.service.output(
        req.session.actor,
        patientId(req.params.id),
        patientId(req.params.settlementId),
        z.enum(["print", "download"]).parse(req.params.action),
      ),
    );
  };
  settlement: RequestHandler = async (req, res) => {
    res.json(
      await this.service.settlement(
        req.session.actor,
        patientId(req.params.id),
        patientId(req.params.settlementId),
      ),
    );
  };
  methods: RequestHandler = async (req, res) => {
    res.json(await this.service.methods(req.session.actor));
  };
  method: RequestHandler = async (req, res) => {
    res.json(
      await this.service.method(
        req.session.actor,
        paymentMethodSchema.parse(req.body),
      ),
    );
  };
  settle: RequestHandler = async (req, res) => {
    res.json(
      await this.service.settle(
        req.session.actor,
        patientId(req.params.id),
        settlementSchema.parse(req.body),
      ),
    );
  };
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
