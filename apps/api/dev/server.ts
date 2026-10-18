import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createApplication } from "../src/application.js";
import { openDatabase } from "../src/database.js";
import { localMail } from "./mail.js";
import {
  localDirectory,
  origin,
  runtimeUrl,
  requireLocalDevelopment,
} from "../../../scripts/local-dev-config.ts";
requireLocalDevelopment();
const secret = await readFile(join(localDirectory, "session-secret"), "utf8");
if (secret.length < 32)
  throw new Error(
    "Start with npm run dev:local to prepare the local session secret.",
  );
const database = openDatabase(runtimeUrl);
await database.connect();
await database.assertRuntimeRole();
const mail = await localMail();
const server = createApplication({
  database,
  sessionSecret: secret,
  origin,
  secureCookies: false,
  mail: mail.adapter,
}).listen(3001, "127.0.0.1", () =>
  console.log("Local fictional API ready on 127.0.0.1:3001."),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await database.close();
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
