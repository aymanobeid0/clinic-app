import type { IdentityAccess } from "../identity/index.js";
export { cleanupExpiredExports } from "./cleanup.js";
import { ExportsController } from "./exports.controller.js";
import { ExportsService } from "./exports.service.js";
import { exportsRoutes } from "./exports.routes.js";
export function createExportRoutes(
  identity: IdentityAccess,
  now: () => number,
  store?: import("../files/index.js").PrivateFileStore,
) {
  return exportsRoutes(
    new ExportsController(new ExportsService(identity, now, store)),
  );
}
