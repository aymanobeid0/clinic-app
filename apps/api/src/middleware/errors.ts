import { AppError } from "../errors/app-error.js";
import type { ErrorRequestHandler, Express, Request } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { validationFields } from "@clinic/contracts";

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

export function installErrorHandling(
  app: Express,
  log: Pick<Logger, "error"> = logger,
) {
  app.use(createErrorHandler(log));
  // The original error is already reported safely. Express's default handler
  // would print its raw stack to stderr, so terminate failed streams here.
  app.use(((_error, _req, res, _next) => {
    res.destroy();
  }) satisfies ErrorRequestHandler);
}

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
      res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
      return;
    }
    if (error instanceof ZodError) {
      const fields = validationFields(error);
      res.status(400).json({ error: "Vérifiez les champs saisis.", ...(Object.keys(fields).length ? { fields } : {}) });
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
        ? "Une erreur empêche de confirmer le résultat. Actualisez l’état avant de réessayer."
        : status === 413
          ? "La requête dépasse la taille autorisée. Réduisez son contenu."
          : "Le corps de la requête n’est pas un JSON valide. Corrigez son format.";
    res.status(status).json({ error: message });
  };
}
