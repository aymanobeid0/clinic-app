import { Router } from "express";
import type { RequestHandler } from "express";
import { AppError } from "../../errors/app-error.js";
import type { ExportsController } from "./exports.controller.js";
export function exportsRoutes(c: ExportsController) {
  const r = Router();
  let active = 0;
  const bounded =
    (handler: RequestHandler): RequestHandler =>
    async (req, res, next) => {
      if (active >= 4) throw new AppError(503, "Exports occupés. Réessayez.");
      active++;
      try {
        await handler(req, res, next);
      } finally {
        active--;
      }
    };
  r.post("/exports", bounded(c.create));
  r.post("/exports/cleanup", c.cleanup);
  r.get("/exports/:id/content", bounded(c.content));
  return r;
}
