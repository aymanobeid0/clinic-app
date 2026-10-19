import { AppError } from "../errors/app-error.js";
import type { ErrorRequestHandler, Request } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";

import { logger } from "../logger.js";

// Never serialize raw errors: database errors can contain SQL values, patient data or credentials.
const safeErrorNames = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError",
  "PrismaClientInitializationError",
  "PrismaClientValidationError",
  "PrismaClientRustPanicError",
]);

export function createErrorHandler(
  log: Pick<Logger, "error"> = logger,
): ErrorRequestHandler {
  const report = (error: unknown, req: Request) => {
    log.error(
      {
        event: "request_failed",
        method: req.method,
        route:
          typeof req.route?.path === "string" ? req.route.path : "unmatched",
        errorType:
          error instanceof Error && safeErrorNames.has(error.name)
            ? error.name
            : "Error",
      },
      "Unhandled API error",
    );
  };
  return (error, req, res, next) => {
    if (res.headersSent) {
      report(error, req);
      next(error);
      return;
    }
    if (error instanceof AppError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof ZodError) {
      res.status(400).json({ error: "Requête invalide." });
      return;
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      res.status(409).json({ error: "Cette valeur est déjà utilisée." });
      return;
    }
    const status =
      error?.status === 400 || error?.status === 413 ? error.status : 500;
    if (status === 500) report(error, req);
    const message =
      status === 500
        ? "Service temporairement indisponible."
        : "Requête invalide.";
    res.status(status).json({ error: message });
  };
}
