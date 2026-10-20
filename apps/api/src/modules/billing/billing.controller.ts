import type { RequestHandler } from "express";
import { z } from "zod";
import {
  openingBalanceSchema,
  reconcileChargeSchema,
  paymentMethodSchema,
  settlementSchema,
  issueInvoiceSchema,
  creditAdjustmentSchema,
  releaseAllocationSchema,
  reversePaymentSchema,
  refundRequestSchema,
  refundActionSchema,
  cancelChargedPlanSchema,
} from "@clinic/contracts";
import type { BillingService } from "./billing.service.js";
const patientId = (value: unknown) => z.uuid().parse(value).toLowerCase();
export class BillingController {
  constructor(readonly service: BillingService) {}
  credit: RequestHandler = async (req, res) => {
    res.json(
      await this.service.credit(
        req.session.actor,
        patientId(req.params.id),
        creditAdjustmentSchema.parse(req.body),
      ),
    );
  };
  release: RequestHandler = async (req, res) => {
    res.json(
      await this.service.release(
        req.session.actor,
        patientId(req.params.id),
        releaseAllocationSchema.parse(req.body),
      ),
    );
  };
  reverse: RequestHandler = async (req, res) => {
    res.json(
      await this.service.reverse(
        req.session.actor,
        patientId(req.params.id),
        reversePaymentSchema.parse(req.body),
      ),
    );
  };
  refundRequest: RequestHandler = async (req, res) => {
    res.json(
      await this.service.refundRequest(
        req.session.actor,
        patientId(req.params.id),
        refundRequestSchema.parse(req.body),
      ),
    );
  };
  refundApprove: RequestHandler = async (req, res) => {
    res.json(
      await this.service.refundAction(
        req.session.actor,
        patientId(req.params.id),
        refundActionSchema.parse(req.body),
        true,
      ),
    );
  };
  refundExecute: RequestHandler = async (req, res) => {
    res.json(
      await this.service.refundAction(
        req.session.actor,
        patientId(req.params.id),
        refundActionSchema.parse(req.body),
        false,
      ),
    );
  };
  cancel: RequestHandler = async (req, res) => {
    res.json(
      await this.service.cancel(
        req.session.actor,
        patientId(req.params.id),
        cancelChargedPlanSchema.parse(req.body),
      ),
    );
  };
  summary: RequestHandler = async (req, res) => {
    res.json(
      await this.service.summary(
        req.session.actor,
        patientId(req.params.id),
        patientId(req.params.planId),
        req.params.action
          ? z.enum(["print", "download"]).parse(req.params.action)
          : undefined,
      ),
    );
  };
  issue: RequestHandler = async (req, res) => {
    res.json(
      await this.service.issue(
        req.session.actor,
        patientId(req.params.id),
        issueInvoiceSchema.parse(req.body),
      ),
    );
  };
  invoices: RequestHandler = async (req, res) => {
    res.json(
      await this.service.invoices(
        req.session.actor,
        patientId(req.params.id),
        req.params.invoiceId ? patientId(req.params.invoiceId) : undefined,
        req.params.action
          ? z.enum(["print", "download"]).parse(req.params.action)
          : undefined,
      ),
    );
  };
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
