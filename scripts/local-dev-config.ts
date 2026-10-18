import { fileURLToPath } from "node:url";
import { join } from "node:path";
export const root = fileURLToPath(new URL("../", import.meta.url));
export const localDirectory = join(root, ".local-dev");
export const ownerUrl =
  "postgresql://clinic_dev_owner:local-fictional-owner@127.0.0.1:55438/clinic_dev";
export const runtimeUrl =
  "postgresql://clinic_dev_runtime:local-fictional-runtime@127.0.0.1:55438/clinic_dev";
export const origin = "http://127.0.0.1:5173";
export function requireLocalDevelopment() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Local development cannot run in production mode.");
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== runtimeUrl)
    throw new Error(
      "Local development requires its fixed clinic_dev runtime database.",
    );
}
