import type { RequestHandler } from "express";
import { z } from "zod";
import {
  createFollowUpSchema,
  updateFollowUpSchema,
  reportDateSchema,
} from "@clinic/contracts";
import type { ReportingService } from "./reporting.service.js";
import { authorizedEvents } from "../../middleware/authorized-events.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
export class ReportingController {
  constructor(
    readonly service: ReportingService,
    readonly updates: ClinicUpdates,
    readonly now: () => number,
  ) {}
  events: RequestHandler = (req, res, next) => {
    const { category } = z
      .object({ category: z.enum(["operational", "financial"]) })
      .strict()
      .parse(req.query);
    let scopes = new Set<string>();
    return authorizedEvents(
      async (actor) => {
        const context = await this.service.authorizeEvents(actor, category);
        scopes = new Set(context.scopes);
        return context.clinicId;
      },
      this.updates,
      this.now,
      (changed) => scopes.has(changed),
    )(req, res, next);
  };
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
