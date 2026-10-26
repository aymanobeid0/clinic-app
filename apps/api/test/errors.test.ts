import { Writable } from "node:stream";
import express from "express";
import pino from "pino";
import request from "supertest";
import { expect, it } from "vitest";
import {
  createErrorHandler,
  installErrorHandling,
} from "../src/middleware/errors.js";

it("identifies missing and invalid known fields in French without echoing secrets", async () => {
  const { replacePasswordSchema, createAccountSchema } = await import("@clinic/contracts");
  const app = express();
  app.use(express.json());
  app.post("/password", (req, res) => res.json(replacePasswordSchema.parse(req.body)));
  app.post("/account", (req, res) => res.json(createAccountSchema.parse(req.body)));
  app.use(createErrorHandler({ error() { throw new Error("Validation must not log input"); } }));
  const missing = await request(app).post("/account").send({});
  expect(missing.status).toBe(400);
  expect(missing.body.fields).toMatchObject({
    username: "Ce champ est obligatoire.",
    temporaryPassword: "Ce champ est obligatoire.",
    displayName: "Ce champ est obligatoire.",
  });
  const invalid = await request(app).post("/password").send({ password: "secret!" });
  expect(invalid.body.fields.password).toBe("Saisissez au moins 12 caractères.");
  expect(JSON.stringify(invalid.body)).not.toContain("secret!");
});

it("bounds nested field guidance and keeps unknown keys, unions and cross-field errors safe", async () => {
  const { z } = await import("zod");
  const app = express();
  app.use(express.json());
  const schema = z.object({
    items: z.array(z.object({ name: z.string().min(1), amount: z.number().min(1) })),
    email: z.email(),
    method: z.union([z.literal("cash"), z.literal("card")]),
    reason: z.string().refine(v => v === "allowed", { message: "private-rule-must-not-be-echoed" }),
  }).strict();
  app.post("/input", (req, res) => res.json(schema.parse(req.body)));
  app.use(createErrorHandler({ error() { throw new Error("Unexpected log"); } }));
  const r = await request(app).post("/input").send({
    items: Array.from({ length: 30 }, () => ({ name: "", amount: "secret-sentinel" })),
    email: "secret-sentinel", method: "secret-sentinel", reason: "secret-sentinel", "secret-key": "secret-sentinel",
  });
  expect(r.status).toBe(400);
  expect(r.body.fields).toMatchObject({ "items.0.name": "Ce champ est obligatoire.", "items.0.amount": "Le type de valeur est incorrect. Vérifiez ce champ." });
  expect(Object.keys(r.body.fields)).toHaveLength(20);
  expect(JSON.stringify(r.body)).not.toMatch(/secret|private-rule/);
  const other = await request(app).post("/input").send({ items: [], email: "invalid", method: {}, reason: "invalid" });
  expect(other.body.fields).toEqual({
    email: "Saisissez une adresse e-mail valide.",
    method: "Sélectionnez une valeur autorisée.",
    reason: "La valeur est invalide. Vérifiez le format et les champs associés.",
  });
});

it("positive revision guidance does not recommend the rejected zero value", async () => {
  const { updateFollowUpSchema } = await import("@clinic/contracts");
  const app = express(); app.use(express.json());
  app.post("/task", (req, res) => res.json(updateFollowUpSchema.parse(req.body)));
  app.use(createErrorHandler());
  const response = await request(app).post("/task").send({ commandId: "11111111-1111-4111-8111-111111111111", revision: 0, status: "open" });
  expect(response.status).toBe(400);
  expect(response.body.fields.revision).toBe("Saisissez une valeur strictement supérieure à 0.");
});
it("query guidance uses the validated value even when an unrelated JSON body is present", async () => {
  const { reportDateSchema } = await import("@clinic/contracts");
  const app = express(); app.use(express.json());
  app.get("/report", (req, res) => res.json(reportDateSchema.parse(req.query)));
  app.use(createErrorHandler());
  const response = await request(app).get("/report?date=invalid").send({ date: "" });
  expect(response.body.fields.date).toBe("La valeur est invalide. Vérifiez le format et les champs associés.");
});

it("rejected async HTTP handlers return a safe 500 and log no request or exception secrets", async () => {
  const chunks: string[] = [];
  const log = pino(
    { timestamp: false },
    new Writable({
      write(chunk, _encoding, done) {
        chunks.push(chunk.toString());
        done();
      },
    }),
  );
  const app = express();
  app.use(express.json());
  app.post("/records/:id", async () => {
    await Promise.resolve();
    const error = new Error(
      "fictional-secret database credentials and patient details",
    );
    error.name = "fictional-secret";
    throw error;
  });
  app.use(createErrorHandler(log));
  const response = await request(app)
    .post("/records/fictional-secret?token=fictional-secret")
    .set("Authorization", "Bearer fictional-secret")
    .set("Cookie", "session=fictional-secret")
    .send({ patient: "fictional-secret" });
  expect(response.status).toBe(500);
  expect(response.body).toEqual({
    error: "Une erreur empêche de confirmer le résultat. Actualisez l’état avant de réessayer.",
  });
  expect(chunks).toHaveLength(1);
  expect(JSON.parse(chunks[0]!)).toMatchObject({
    level: 50,
    event: "request_failed",
    method: "POST",
    route: "/records/:id",
    errorType: "Error",
  });
  expect(chunks.join("")).not.toContain("fictional-secret");
});

it("delegates errors after response headers are sent without attempting another JSON response", async () => {
  const app = express();
  app.get("/stream", async (_req, res) => {
    res.write("started");
    await Promise.resolve();
    throw new Error("fictional stream failure");
  });
  const sink = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  app.use(createErrorHandler(pino(sink)));
  app.use(((error, _req, res, _next) => {
    res.end(
      error instanceof Error && error.message === "fictional stream failure"
        ? "-delegated"
        : "-wrong-error",
    );
  }) satisfies import("express").ErrorRequestHandler);
  const response = await request(app).get("/stream");
  expect(response.status).toBe(200);
  expect(response.text).toBe("started-delegated");
});

it("shared application failures keep their status and French message without being logged as unexpected", async () => {
  const { AppError } = await import("../src/errors/app-error.js");
  const chunks: string[] = [];
  const log = pino(
    new Writable({
      write(chunk, _encoding, done) {
        chunks.push(chunk.toString());
        done();
      },
    }),
  );
  const app = express();
  app.get("/settle", async () => {
    throw new AppError(409, "Crédit disponible insuffisant.");
  });
  app.use(createErrorHandler(log));
  const response = await request(app).get("/settle");
  expect(response.status).toBe(409);
  expect(response.body).toEqual({ error: "Crédit disponible insuffisant." });
  expect(chunks).toEqual([]);
});

it.each([
  ["validation", 400, "Vérifiez les champs saisis."],
  ["unique", 409, "Cette valeur est déjà utilisée."],
  ["bad-json", 400, "Le corps de la requête n’est pas un JSON valide. Corrigez son format."],
  ["too-large", 413, "La requête dépasse la taille autorisée. Réduisez son contenu."],
] as const)(
  "preserves the safe %s HTTP response",
  async (kind, status, message) => {
    const { z } = await import("zod");
    const app = express();
    app.use(express.json({ limit: "16kb" }));
    app.post("/input", async () => {
      if (kind === "validation")
        z.object({ name: z.string() }).parse({ name: 42 });
      if (kind === "unique")
        throw Object.assign(new Error("fictional-secret"), { code: "P2002" });
    });
    const chunks: string[] = [];
    app.use(
      createErrorHandler(
        pino(
          new Writable({
            write(chunk, _encoding, done) {
              chunks.push(chunk.toString());
              done();
            },
          }),
        ),
      ),
    );
    const command = request(app)
      .post("/input")
      .set("Content-Type", "application/json");
    const response = await (kind === "bad-json"
      ? command.send("{")
      : command.send({ value: kind === "too-large" ? "x".repeat(17000) : "" }));
    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ error: message });
    expect(chunks).toEqual([]);
  },
);

it("the production error pipeline closes failed streams without leaking the original exception to stderr", async () => {
  const { vi } = await import("vitest");
  const chunks: string[] = [];
  const log = pino(
    new Writable({
      write(chunk, _encoding, done) {
        chunks.push(chunk.toString());
        done();
      },
    }),
  );
  const app = express();
  app.set("env", "production");
  app.get("/stream", async (_req, res) => {
    res.write("started");
    await Promise.resolve();
    throw new Error("fictional-secret patient data and database credentials");
  });
  installErrorHandling(app, log);
  const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(request(app).get("/stream")).rejects.toThrow(
      /aborted|socket hang up/,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(stderr).not.toHaveBeenCalled();
    expect(chunks).toHaveLength(1);
    expect(chunks.join("")).not.toContain("fictional-secret");
  } finally {
    stderr.mockRestore();
  }
});
