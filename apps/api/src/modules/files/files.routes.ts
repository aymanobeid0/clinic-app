import { Router, raw, type RequestHandler } from "express";
import type { FilesController } from "./files.controller.js";
import { AppError } from "../../errors/app-error.js";
export function filesRoutes(controller: FilesController) {
  const router = Router(),
    base = "/patients/:patientId/attachments";
  // Bound in-memory bodies across this API process, including slow senders.
  let inflight = 0;
  const bounded: RequestHandler = (_req, res, next) => {
    if (inflight >= 4)
      throw new AppError(503, "Téléversements occupés. Réessayez.");
    inflight++;
    res.once("close", () => {
      inflight--;
    });
    next();
  };
  router.get(base, controller.list);
  router.get(base + "/:attachmentId/history", controller.history);
  router.get(
    base + "/:attachmentId/versions/:revision/content",
    controller.content,
  );
  router.post(
    base,
    controller.preflight,
    bounded,
    raw({
      type: ["application/pdf", "image/jpeg", "image/png"],
      limit: 20_000_000,
    }),
    controller.upload,
  );
  router.post(
    base + "/:attachmentId/versions",
    controller.preflight,
    bounded,
    raw({
      type: ["application/pdf", "image/jpeg", "image/png"],
      limit: 20_000_000,
    }),
    controller.upload,
  );
  router.post(base + "/:attachmentId/remove", controller.remove);
  return router;
}
