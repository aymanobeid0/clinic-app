import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { openDatabase } from "../src/database.js";
import {
  ownerUrl,
  runtimeUrl,
  root,
  requireLocalDevelopment,
} from "../../../scripts/local-dev-config.ts";
requireLocalDevelopment();
const owner = openDatabase(ownerUrl),
  runtime = openDatabase(runtimeUrl);
try {
  await owner.connect();
  await owner.pool.query(
    await readFile(join(root, "infra/dev-runtime.sql"), "utf8"),
  );
  await runtime.connect();
  await runtime.assertRuntimeRole();
  console.log("Dedicated local runtime role verified.");
} finally {
  await runtime.close();
  await owner.close();
}
