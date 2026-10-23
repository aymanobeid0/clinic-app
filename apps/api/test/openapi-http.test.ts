import { readFile } from "node:fs/promises";
import { Ajv2020 } from "ajv/dist/2020.js";
import request from "supertest";
import { expect, it } from "vitest";
import { createApplication } from "../src/application.js";
import { openDatabase } from "../src/database.js";
const artifact = new URL("../../../docs/api/openapi.json", import.meta.url);

it("describes real anonymous-session and denied-write HTTP responses", async () => {
  const document = JSON.parse(await readFile(artifact, "utf8"));
  const database = openDatabase(
    "postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:55437/clinic_issue7",
  );
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  const validate = (schema: object, value: unknown) => {
    const check = ajv.compile({ ...schema, components: document.components });
    expect(check(value), JSON.stringify(check.errors)).toBe(true);
  };
  try {
    await database.connect();
    const app = createApplication({
      database,
      sessionSecret: "fictional-doc-session-secret-at-least-32-characters",
      origin: "http://localhost:4173",
      secureCookies: false,
    });
    const browser = request.agent(app);
    const session = await browser.get("/api/session");
    expect(session.status).toBe(200);
    expect(session.headers["set-cookie"][0]).toContain("clinic.sid=");
    validate(
      document.paths["/session"].get.responses["200"].content[
        "application/json"
      ].schema,
      session.body,
    );
    const denied = await browser
      .post("/api/sign-in")
      .set("Origin", "https://foreign.invalid")
      .set("x-csrf-token", session.body.csrfToken)
      .send({
        method: "email",
        email: "manager@example.invalid",
        password: "Fictional-never-valid-123",
      });
    expect(denied.status).toBe(403);
    validate(
      document.paths["/sign-in"].post.responses["403"].content[
        "application/json"
      ].schema,
      denied.body,
    );
    expect((await browser.get("/api/identity")).status).toBe(401);
  } finally {
    await database.close();
  }
});
