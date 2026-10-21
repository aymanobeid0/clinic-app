import { Worker } from "node:worker_threads";
import { AppError } from "../../errors/app-error.js";
let activeWorkers = 0;

// Keep untrusted PDF parsing/decompression off the API event loop. Node 24
// strips worker source types in development; tsc emits .js for production.
export async function validateContent(bytes: Buffer, mediaType: string) {
  if (!bytes.length || bytes.length > 20_000_000)
    throw new AppError(413, "Maximum 20 000 000 octets par fichier.");
  if (activeWorkers >= 4)
    throw new AppError(503, "Validation de fichiers occupée. Réessayez.");
  const valid = await new Promise<boolean>((resolve) => {
    const worker = new Worker(
      new URL(
        import.meta.url.endsWith(".ts")
          ? "./validate-content.worker.ts"
          : "./validate-content.worker.js",
        import.meta.url,
      ),
      {
        workerData: { bytes, mediaType },
        execArgv: [],
        resourceLimits: {
          maxOldGenerationSizeMb: 64,
          maxYoungGenerationSizeMb: 16,
          stackSizeMb: 2,
        },
        stdout: true,
        stderr: true,
      },
    );
    activeWorkers++;
    worker.once("exit", () => {
      activeWorkers--;
    });
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), 5000);
    worker.once("message", (value) => finish(value === true));
    worker.once("error", () => finish(false));
    worker.once("exit", () => finish(false));
  });
  if (!valid)
    throw new AppError(
      400,
      "Fichier invalide, corrompu ou contenu actif non pris en charge.",
    );
}
