import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createServer as httpServer } from "node:http";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import {
  root,
  localDirectory,
  runtimeUrl,
  ownerUrl,
} from "./local-dev-config.ts";
const compose = [
  "compose",
  "-p",
  "clinic-local-dev",
  "-f",
  join(root, "infra/compose.dev.yml"),
];
const runnerPath = join(localDirectory, "runner.json"),
  controlPort = 5174;
const children = new Set<ChildProcess>();
let stopping = false;
let ownsState = false;
const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL: runtimeUrl,
  CLINIC_API_PORT: "3001",
  CLINIC_WEB_PORT: "5173",
};
function launch(
  command: string,
  args: string[],
  options: { cwd?: string; quiet?: boolean } = {},
) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? root,
    env,
    stdio: options.quiet ? "ignore" : "inherit",
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}
function wait(child: ChildProcess) {
  return new Promise<void>((resolve, reject) => {
    child.once("error", () =>
      reject(
        new Error(
          "Unable to start a required local tool. Check Node, npm and Docker Desktop.",
        ),
      ),
    );
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "Local setup command failed. Check the preceding tool diagnostics; existing local data was retained.",
            ),
          ),
    );
  });
}
async function run(
  command: string,
  args: string[],
  options: { cwd?: string; quiet?: boolean } = {},
) {
  await wait(launch(command, args, options));
}
const npmCli =
  process.env.npm_execpath ??
  join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
async function npm(args: string[]) {
  if (!existsSync(npmCli))
    throw new Error(
      "npm CLI was not found. Install Node.js 24 with npm, then run npm run dev:local.",
    );
  await run(process.execPath, [npmCli, ...args]);
}
async function freePort(port: number) {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        new Error(
          `Port ${port} is occupied. Stop the other service or use Stop-Clinic.cmd for this local runner.`,
        ),
      ),
    );
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve()));
  });
}
async function kill(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const task = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      task.once("exit", () => resolve());
      task.once("error", () => resolve());
    });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* already stopped */
    }
  }
}
let control: ReturnType<typeof httpServer> | undefined;
const token = randomBytes(32).toString("hex");
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await Promise.all([...children].map(kill));
  control?.close();
  if (ownsState) await rm(runnerPath, { force: true });
  console.log(
    "Local API and web watchers stopped. Database retained; npm run dev:local:stop also stops the database.",
  );
}
async function stop() {
  let state: { token: string } | undefined;
  try {
    state = JSON.parse(await readFile(runnerPath, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("Cannot read the local runner state.");
  }
  if (state) {
    try {
      const response = await fetch(`http://127.0.0.1:${controlPort}/stop`, {
        method: "POST",
        headers: { "x-clinic-local-control": state.token },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new Error("Local stop control rejected the request.");
    } catch (e) {
      if (
        e instanceof Error &&
        e.message === "Local stop control rejected the request."
      )
        throw e;
      console.log(
        "No responsive local runner found; stopping only the dedicated development database.",
      );
    }
  }
  await run("docker", [...compose, "stop"]);
  console.log(
    "Dedicated local database stopped. Its persistent volume is retained.",
  );
}
async function localDocker() {
  let endpoint = process.env.DOCKER_HOST;
  if (!endpoint || process.env.DOCKER_CONTEXT) {
    endpoint = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        "docker",
        ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
        { env, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
      );
      children.add(child);
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += String(chunk);
      });
      child.once("error", () =>
        reject(
          new Error(
            "Docker Desktop is required. Start Docker Desktop and retry.",
          ),
        ),
      );
      child.once("exit", (code) => {
        children.delete(child);
        if (code === 0) resolve(output.trim());
        else
          reject(
            new Error(
              "Cannot inspect the Docker context. Start Docker Desktop and retry.",
            ),
          );
      });
    });
  }
  const local = (value: string) =>
    value.startsWith("npipe:////./pipe/") || value.startsWith("unix:///");
  if (
    !endpoint ||
    !local(endpoint) ||
    (process.env.DOCKER_HOST && !local(process.env.DOCKER_HOST))
  )
    throw new Error(
      "Local development requires a local Docker Desktop socket. Remote Docker hosts and contexts are refused.",
    );
  env.DOCKER_HOST = endpoint;
  delete env.DOCKER_CONTEXT;
}
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("The local runner refuses production mode.");
  if (Number(process.versions.node.split(".")[0]) !== 24)
    throw new Error("Node.js 24 LTS is required.");
  if (process.argv.includes("--stop")) {
    await localDocker();
    await stop();
    return;
  }
  await mkdir(localDirectory, { recursive: true });
  await freePort(3001);
  await freePort(5173);
  control = httpServer((req, res) => {
    const supplied = req.headers["x-clinic-local-control"];
    const valid =
      typeof supplied === "string" &&
      /^[a-f0-9]{64}$/.test(supplied) &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
    if (req.method !== "POST" || req.url !== "/stop" || !valid) {
      res.writeHead(403).end();
      return;
    }
    void shutdown().then(() => res.end("Local runner stopped."));
  });
  await new Promise<void>((resolve, reject) => {
    control!.once("error", () =>
      reject(
        new Error(
          "Another local runner owns control port 5174. Use Stop-Clinic.cmd first.",
        ),
      ),
    );
    control!.listen(controlPort, "127.0.0.1", resolve);
  });
  await writeFile(
    runnerPath,
    JSON.stringify({ pid: process.pid, token }) + "\n",
    { mode: 0o600 },
  );
  ownsState = true;
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  await localDocker();
  try {
    await run("docker", ["version", "--format", "{{.Server.Version}}"], {
      quiet: true,
    });
    await run("docker", ["compose", "version", "--short"], { quiet: true });
  } catch {
    throw new Error(
      "Docker Desktop with Docker Compose is required. Start Docker Desktop and retry npm run dev:local.",
    );
  }
  const fingerprint = createHash("sha256")
    .update(await readFile(join(root, "package-lock.json")))
    .digest("hex");
  let installed = "";
  try {
    installed = await readFile(join(localDirectory, "installed-lock"), "utf8");
  } catch {
    /* first run */
  }
  if (
    !existsSync(join(root, "node_modules/tsx/dist/cli.mjs")) ||
    installed !== fingerprint
  ) {
    await npm(["ci", "--include=dev"]);
    await writeFile(join(localDirectory, "installed-lock"), fingerprint);
  }
  await npm(["run", "build", "--workspace", "@clinic/contracts"]);
  await npm(["run", "db:generate", "--workspace", "@clinic/api"]);
  await run("docker", [...compose, "up", "-d", "--wait"]);
  // A fixed owner target overrides every ambient/live DATABASE_URL before Prisma starts.
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"],
      {
        cwd: join(root, "apps/api"),
        env: { ...env, DATABASE_URL: ownerUrl },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    children.add(child);
    child.once("error", reject);
    child.once("exit", (code) => {
      children.delete(child);
      if (code === 0) resolve();
      else
        reject(
          new Error(
            "Dedicated local migrations failed; no reset was performed.",
          ),
        );
    });
  });
  await run(process.execPath, [
    join(root, "node_modules/tsx/dist/cli.mjs"),
    "apps/api/dev/prepare.ts",
  ]);
  const secret = join(localDirectory, "session-secret");
  if (!existsSync(secret))
    await writeFile(secret, randomBytes(32).toString("hex"), {
      mode: 0o600,
      flag: "wx",
    });
  await run(process.execPath, [
    join(root, "node_modules/tsx/dist/cli.mjs"),
    "apps/api/dev/seed.ts",
  ]);
  if (stopping) return;
  const watchers = [
    launch(process.execPath, [
      join(root, "node_modules/typescript/bin/tsc"),
      "-p",
      "packages/contracts/tsconfig.build.json",
      "--watch",
      "--preserveWatchOutput",
    ]),
    launch(process.execPath, [
      join(root, "node_modules/tsx/dist/cli.mjs"),
      "watch",
      "--clear-screen=false",
      "apps/api/dev/server.ts",
    ]),
    launch(process.execPath, [join(root, "node_modules/vite/bin/vite.js")], {
      cwd: join(root, "apps/web"),
    }),
  ];
  for (const child of watchers) {
    child.once("error", () => {
      console.error("A development watcher could not start.");
      process.exitCode = 1;
      void shutdown();
    });
    child.once("exit", (code) => {
      if (!stopping) {
        console.error("A development watcher stopped unexpectedly.");
        process.exitCode = code ?? 1;
        void shutdown();
      }
    });
  }
  console.log(
    "Local fictional workspace: http://127.0.0.1:5173 (API 3001, database 55438).",
  );
  console.log(
    "Use Ctrl+C to stop watchers, or Stop-Clinic.cmd to stop watchers and database. Mail is captured only in .local-dev/mailbox.json.",
  );
}
try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Local development startup failed.",
  );
  process.exitCode = 1;
  await shutdown();
}
