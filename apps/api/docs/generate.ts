import { readFile, writeFile } from "node:fs/promises";
import { buildOpenApi } from "./openapi.js";

const path = new URL("../../../docs/api/openapi.json", import.meta.url);
const content = JSON.stringify(buildOpenApi(), null, 2) + "\n";
if (process.argv.includes("--check")) {
  if ((await readFile(path, "utf8")) !== content)
    throw new Error("OpenAPI is stale. Run npm run docs:api:generate.");
  process.stdout.write("OpenAPI artifact is current.\n");
} else {
  await writeFile(path, content);
  process.stdout.write("Generated docs/api/openapi.json.\n");
}
