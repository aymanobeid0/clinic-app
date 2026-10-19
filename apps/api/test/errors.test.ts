import { Writable } from "node:stream";
import express from "express";
import pino from "pino";
import request from "supertest";
import { expect, it } from "vitest";
import { createErrorHandler } from "../src/middleware/errors.js";

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
    error: "Service temporairement indisponible.",
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
  ["validation", 400, "Requête invalide."],
  ["unique", 409, "Cette valeur est déjà utilisée."],
  ["bad-json", 400, "Requête invalide."],
  ["too-large", 413, "Requête invalide."],
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
    expect(response.body).toEqual({ error: message });
    expect(chunks).toEqual([]);
  },
);
