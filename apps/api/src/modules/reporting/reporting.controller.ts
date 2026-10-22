import type { RequestHandler } from "express";
import { z } from "zod";
import {
  createFollowUpSchema,
  updateFollowUpSchema,
  reportDateSchema,
} from "@clinic/contracts";
import type { ReportingService } from "./reporting.service.js";
export class ReportingController {
  constructor(readonly service: ReportingService) {}
  tasks: RequestHandler = async (req, res) => {
    res.json(await this.service.tasks(req.session.actor));
  };
  createTask: RequestHandler = async (req, res) => {
    res.json(
      await this.service.changeTask(
        req.session.actor,
        undefined,
        createFollowUpSchema.parse(req.body),
      ),
    );
  };
  updateTask: RequestHandler = async (req, res) => {
    res.json(
      await this.service.changeTask(
        req.session.actor,
        z.uuid().parse(req.params.id).toLowerCase(),
        updateFollowUpSchema.parse(req.body),
      ),
    );
  };
  history: RequestHandler = async (req, res) => {
    res.json(
      await this.service.history(
        req.session.actor,
        z.uuid().parse(req.params.id).toLowerCase(),
      ),
    );
  };
  share: RequestHandler = async (req, res) => {
    res.json(
      await this.service.history(
        req.session.actor,
        z.uuid().parse(req.params.id).toLowerCase(),
        true,
      ),
    );
  };
  stock: RequestHandler = async (req, res) => {
    res.json(await this.service.stock(req.session.actor));
  };
  financial: RequestHandler = async (req, res) => {
    const { date } = reportDateSchema.parse(req.query);
    res.json(await this.service.financial(req.session.actor, date));
  };
  appointments: RequestHandler = async (req, res) => {
    const { date } = reportDateSchema.parse(req.query);
    res.json(await this.service.appointments(req.session.actor, date));
  };
}
