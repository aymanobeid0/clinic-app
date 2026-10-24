import {
  recoverCodeSchema,
  recoverEmailSchema,
  recoverRequestSchema,
} from "@clinic/contracts";
import type { z } from "zod";
import { post, refreshSession } from "./identity.api.js";

export type RecoveryCommand =
  | { route: "code"; input: z.input<typeof recoverCodeSchema> }
  | { route: "email"; input: z.input<typeof recoverEmailSchema> }
  | { route: "request"; input: z.input<typeof recoverRequestSchema> };

export async function recoverAccount(command: RecoveryCommand) {
  const schemas = {
    code: recoverCodeSchema,
    email: recoverEmailSchema,
    request: recoverRequestSchema,
  };
  const input = schemas[command.route].parse(command.input);
  await refreshSession();
  await post(`recovery/${command.route}`, input);
}
