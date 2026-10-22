import type { RequestHandler } from "express";
import { z } from "zod";
import type { IdentityService } from "./identity.service.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { authorizedEvents } from "../../middleware/authorized-events.js";
export class HistoricalController {
  constructor(
    readonly service: IdentityService,
    readonly updates: ClinicUpdates,
    readonly now: () => number,
  ) {}
  patients: RequestHandler = async (req, res) => {
    res.json(await this.service.historicalPatients(req.session.actor));
  };
  snapshot: RequestHandler = async (req, res) => {
    res.json(
      await this.service.historicalSnapshot(
        req.session.actor,
        z.uuid().parse(req.params.id),
      ),
    );
  };
  events: RequestHandler = (req, res, next) =>
    authorizedEvents(
      async (actor) => {
        await this.service.historicalSnapshot(
          actor,
          z.uuid().parse(req.params.id),
        );
        return actor!.clinicId;
      },
      this.updates,
      this.now,
    )(req, res, next);
}
