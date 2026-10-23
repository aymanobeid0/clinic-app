import { z } from "zod";
import * as contracts from "@clinic/contracts";
import { operations, type Operation } from "./operations.js";
import { responseSchemas, type Schema } from "./response-schemas.js";
import { examples } from "./examples.js";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const uuid = { type: "string", format: "uuid" };
const integer = { type: "integer", minimum: 1 };
type Parameter = {
  name: string;
  in: "path" | "query" | "header";
  required: boolean;
  schema: Schema;
  description?: string;
};
const query = (name: string, schema: Schema, required = false): Parameter => ({
  name,
  in: "query",
  schema,
  required,
});
const values = (...items: string[]) => ({ type: "string", enum: items });

function parameters(operation: Operation): Parameter[] {
  const p = operation.path;
  const result: Parameter[] = [...p.matchAll(/\{([^}]+)\}/g)].map(
    ([, name]) => ({
      name,
      in: "path",
      required: true,
      schema:
        name === "revision"
          ? integer
          : name === "kind"
            ? values("history", "chart")
            : name === "action"
              ? p.startsWith("/billing")
                ? values("print", "download")
                : values("draft", "finalize")
              : uuid,
    }),
  );
  if (operation.method === "post")
    result.push(
      {
        name: "Origin",
        in: "header",
        required: true,
        schema: { type: "string", format: "uri" },
        description:
          "Exact configured APP_ORIGIN; local default http://localhost:4173, not necessarily the API URL.",
      },
      {
        name: "x-csrf-token",
        in: "header",
        required: true,
        schema: { type: "string", pattern: "^[a-f0-9]{64}$" },
        description:
          "Current session csrfToken. Refresh after login/recovery rotation; never put in shared environment exports.",
      },
    );
  if (
    ["/patients", "/assignment-patients"].includes(p) &&
    operation.method === "get"
  )
    result.push(
      query("q", { type: "string", maxLength: 120, default: "" }),
      query("archived", { ...values("true", "false"), default: "false" }),
      query("offset", {
        type: "integer",
        minimum: 0,
        maximum: 2147483647,
        default: 0,
      }),
    );
  if (p === "/appointments") {
    if (operation.method === "get")
      result.push(
        query("date", { type: "string", format: "date" }, true),
        query("dentistId", uuid),
      );
  }
  if (p === "/appointments/choices")
    result.push(query("q", { type: "string", maxLength: 120, default: "" }));
  if (p === "/medications" && operation.method === "get")
    result.push(
      query("q", { type: "string", maxLength: 160, default: "" }),
      query("retired", values("true", "false")),
    );
  if (p === "/reports/events")
    result.push(query("category", values("operational", "financial"), true));
  if (["/reports/financial", "/reports/appointments"].includes(p))
    result.push(query("date", { type: "string", format: "date" }, true));
  if (p.includes("/attachments") && !p.startsWith("/historical")) {
    if (operation.request === "binary") {
      result.push(
        query("commandId", uuid, true),
        query("classification", values("clinical", "financial", "mixed"), true),
        query(
          "name",
          {
            type: "string",
            minLength: 1,
            maxLength: 180,
            pattern: "^[^\\x00-\\x1f\\x7f/\\\\]+$",
          },
          true,
        ),
        query("revision", integer, p.endsWith("/versions")),
        query(
          "reason",
          { type: "string", minLength: 1, maxLength: 1000 },
          p.endsWith("/versions"),
        ),
      );
    } else
      result.push(
        query("classification", values("clinical", "financial", "mixed"), true),
      );
  }
  if (operation.response === "File")
    result.push(
      query(
        "output",
        p.startsWith("/historical")
          ? values("inline")
          : { ...values("inline", "download", "print"), default: "inline" },
      ),
    );
  return result;
}

export function buildOpenApi() {
  const schemas: Record<string, Schema> = {
    ...responseSchemas(),
    Error: {
      type: "object",
      properties: { error: { type: "string" } },
      required: ["error"],
    },
  };
  const paths: Record<string, Record<string, unknown>> = {};
  const tags = [...new Set(operations.map((o) => o.tag))].map((name) => ({
    name,
  }));
  const contract = contracts as unknown as Record<string, z.ZodType>;
  const requestRef = (name: string) => {
    if (!contract[name]?.safeParse)
      throw new Error(`Missing shared request schema ${name}`);
    schemas[name] ??= z.toJSONSchema(contract[name], { io: "input" });
    return ref(name);
  };
  for (const o of operations) {
    const example = examples[`${o.method} ${o.path}`];
    const responses: Record<string, unknown> = {};
    const content: Record<string, unknown> = {};
    if (o.response === "SSE")
      content["text/event-stream"] = {
        schema: { type: "string" },
        example: "event: invalidate\ndata: {}\n\n",
      };
    else if (o.response === "File") {
      for (const media of ["application/pdf", "image/jpeg", "image/png"])
        content[media] = { schema: { type: "string", format: "binary" } };
    } else if (o.response === "ExportContent") {
      content["application/json"] = {
        schema: {
          type: "object",
          properties: {
            schemaVersion: { const: 1 },
            generatedAt: { type: "string" },
            category: { type: "string" },
            data: {},
          },
          required: ["schemaVersion", "generatedAt", "category", "data"],
        },
      };
      content["text/csv"] = {
        schema: { type: "string" },
        example:
          '\uFEFF"path","value"\r\n"data.patient.name","Patient fictif"\r\n',
      };
      content["application/zip"] = {
        schema: { type: "string", format: "binary" },
      };
    } else if (o.response) {
      if (!schemas[o.response])
        throw new Error(`Missing response schema ${o.response}`);
      content["application/json"] = {
        schema: ref(o.response),
        ...(example?.response !== undefined
          ? { example: example.response }
          : {}),
      };
    }
    responses[o.status ?? 200] = {
      description:
        o.response === "SSE"
          ? "Authorized invalidation stream. Recheck access on events/heartbeat; refetch on reconnect. Not a JSON list."
          : o.path === "/onboarding/verify-email"
            ? "Recovery-code JSON for manager setup; ordinary verified email replacement/non-manager setup can return JSON null."
            : o.response
              ? "Successful authorized response."
              : "Successful response with no body.",
      ...(Object.keys(content).length ? { content } : {}),
      headers: {
        "Cache-Control": {
          schema: { type: "string" },
          description: "no-store under /api after the rate limiter.",
        },
        ...([
          "/session",
          "/sign-in",
          "/sign-out",
          "/password",
          "/onboarding/password",
          "/recovery/code",
          "/recovery/email",
        ].includes(o.path)
          ? {
              "Set-Cookie": {
                schema: { type: "string" },
                description:
                  "Creates/rotates or clears clinic.sid as appropriate; HttpOnly, SameSite=Lax, Secure except explicitly configured local HTTP. Let the cookie manager handle it; never paste a live cookie into examples.",
              },
            }
          : {}),
        ...(["File", "ExportContent"].includes(o.response ?? "")
          ? {
              "Content-Disposition": {
                schema: { type: "string" },
                description:
                  "Authorized inline or attachment delivery with safe filename; no public object URL.",
              },
            }
          : {}),
      },
    };
    const errors: Record<number, string> = {
      400: "Invalid input, unsupported precision or domain validation. See operation and shared schema; business refinements are enforced on server.",
      401: "Missing, expired or revoked session, invalid credentials or current password.",
      403: "Origin/CSRF failure, missing capability, wrong account stage/kind or patient/content scope. Client IDs confer no authority.",
      404: "Missing or inaccessible clinic/patient/record. Do not infer another clinic exists.",
      409: "Stale revision, changed command payload/actor, conflicting state or exhausted funds/stock/quota. Fetch current state and reconcile.",
      413: "Body/file/source or export exceeds supported limits; never silently truncated.",
      500: "Sanitized unexpected failure; failed consequential transactions roll back.",
      503: "Required mail/private file service unavailable or bounded work busy. Retry only as documented.",
    };
    // Reusable possible failure envelope, not a claim every route emits every code.
    for (const [code, description] of Object.entries(errors))
      responses[code] = {
        description,
        content: {
          "application/json": {
            schema: ref("Error"),
            example: { error: "Requête non autorisée." },
          },
        },
      };
    responses[429] = {
      description:
        "Global IP or login/recovery identity limit. Global limiter may return text/html; identity limit returns JSON.",
      content: {
        "text/html": { schema: { type: "string" } },
        "application/json": { schema: ref("Error") },
      },
    };
    if (o.response === "ExportContent")
      responses[410] = {
        description: "Export expired before cleanup.",
        content: { "application/json": { schema: ref("Error") } },
      };
    const body =
      o.request === "binary"
        ? {
            required: true,
            description:
              "Raw validated bytes, NOT multipart/form-data. Metadata is query parameters. Max20,000,000bytes.",
            content: Object.fromEntries(
              ["application/pdf", "image/jpeg", "image/png"].map((media) => [
                media,
                {
                  schema: {
                    type: "string",
                    format: "binary",
                    maxLength: 20_000_000,
                  },
                },
              ]),
            ),
          }
        : o.request
          ? {
              required: true,
              content: {
                "application/json": {
                  schema: o.request.includes("|")
                    ? { anyOf: o.request.split("|").map(requestRef) }
                    : requestRef(o.request),
                  ...(example?.request !== undefined
                    ? { example: example.request }
                    : {}),
                },
              },
            }
          : undefined;
    const retry =
      o.request &&
      o.request !== "binary" &&
      o.request.split("|").some((n) => {
        const schema = requestRef(n);
        return JSON.stringify(schemas[n]).includes('"commandId"') && !!schema;
      })
        ? "\n\nRetain commandId and exact payload for an uncertain-response retry; a changed payload needs a new command after reconciliation. Current authorization is rechecked. No generic Idempotency-Key header."
        : "";
    const operationId =
      o.method + o.path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/_$/, "");
    paths[o.path] ??= {};
    if (paths[o.path][o.method])
      throw new Error(`Duplicate operation ${o.method} ${o.path}`);
    paths[o.path][o.method] = {
      operationId,
      tags: [o.tag],
      summary: o.summary,
      description: o.description + retry,
      parameters: parameters(o),
      responses,
      ...(body ? { requestBody: body } : {}),
      ...(o.path === "/session" ? { security: [] } : {}),
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Clinic API",
      version: "1.0.0",
      description:
        "Existing backend/API contracts. Import this generated file into Apidog. Cookie sessions, same-origin CSRF writes, current account/clinic/patient authorization. No public registration, fake verification, bearer tokens or production readiness claim. JSON Schema cannot encode all permission, financial, temporal or cross-field rules: consult each operation and repository API guides.",
    },
    servers: [
      {
        url: "http://localhost:3000/api",
        description:
          "Local fictional-data API only; APP_ORIGIN normally http://localhost:4173.",
      },
    ],
    tags,
    security: [{ sessionCookie: [] }],
    paths,
    components: {
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "clinic.sid",
          description:
            "HttpOnly session cookie (anonymous before login, authenticated after). Let cookie manager retain/rotate it. Never place actual cookie values in shared documentation.",
        },
      },
      schemas,
    },
  };
}
