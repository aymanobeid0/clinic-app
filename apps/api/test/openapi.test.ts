import { readFile, readdir } from "node:fs/promises";
import SwaggerParser from "@apidevtools/swagger-parser";
import ts from "typescript";
import { expect, it } from "vitest";
import { buildOpenApi } from "../docs/openapi.js";
import { Ajv2020 } from "ajv/dist/2020.js";

const artifact = new URL("../../../docs/api/openapi.json", import.meta.url);

it("provides a valid portable OpenAPI document for Apidog", async () => {
  const document = JSON.parse(await readFile(artifact, "utf8"));
  const validated = await SwaggerParser.validate(document, {
    resolve: { external: false },
  });
  expect(validated.info.title).toBe("Clinic API");
  expect(Object.keys(validated.paths ?? {}).length).toBeGreaterThan(0);
});

it("keeps the portable artifact current with source contracts and operation metadata", async () => {
  expect(await readFile(artifact, "utf8")).toBe(
    JSON.stringify(buildOpenApi(), null, 2) + "\n",
  );
}, 60000);

it("documents exactly the registered method/path operations including raw file and dynamic action routes", async () => {
  const root = new URL("../src/modules/", import.meta.url);
  const files = (await readdir(root, { recursive: true })).filter((p) =>
    p.endsWith(".routes.ts"),
  );
  const registered: string[] = [];
  for (const path of files) {
    const file = ts.createSourceFile(
      path,
      await readFile(new URL(path.replaceAll("\\", "/"), root), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const constants = new Map<string, ts.Expression>();
    const collect = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      )
        constants.set(node.name.text, node.initializer);
      ts.forEachChild(node, collect);
    };
    collect(file);
    const routePath = (node: ts.Expression): string => {
      if (ts.isStringLiteralLike(node)) return node.text;
      if (ts.isIdentifier(node) && constants.has(node.text))
        return routePath(constants.get(node.text)!);
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.PlusToken
      )
        return routePath(node.left) + routePath(node.right);
      throw new Error(
        `Unrecognized registered route expression in ${path}; update the coverage check explicitly.`,
      );
    };
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ["r", "router"].includes(node.expression.expression.getText(file)) &&
        ["get", "post", "put", "patch", "delete", "head", "options"].includes(
          node.expression.name.text,
        )
      ) {
        registered.push(
          node.expression.name.text +
            " " +
            routePath(node.arguments[0]).replace(/:([a-zA-Z]+)/g, "{$1}"),
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  const document = JSON.parse(await readFile(artifact, "utf8"));
  const documented = Object.entries(document.paths).flatMap(([path, methods]) =>
    Object.keys(methods as object).map((method) => method + " " + path),
  );
  expect(documented.sort()).toEqual(registered.sort());
  expect(new Set(documented).size).toBe(documented.length);
});

it("keeps cookie/CSRF, raw binary, JSON documents and event streams distinct", async () => {
  const document = JSON.parse(await readFile(artifact, "utf8"));
  expect(document.components.securitySchemes.sessionCookie).toMatchObject({
    in: "cookie",
    name: "clinic.sid",
  });
  expect(document.paths["/session"].get.security).toEqual([]);
  expect(
    document.paths["/sign-in"].post.parameters.map(
      (p: { name: string }) => p.name,
    ),
  ).toEqual(["Origin", "x-csrf-token"]);
  expect(
    Object.keys(
      document.paths["/patients/{patientId}/attachments"].post.requestBody
        .content,
    ).sort(),
  ).toEqual(["application/pdf", "image/jpeg", "image/png"]);
  expect(
    document.paths["/patients/{patientId}/attachments"].post.parameters,
  ).toContainEqual(
    expect.objectContaining({
      name: "classification",
      in: "query",
      required: true,
    }),
  );
  expect(
    document.paths["/billing/{id}/invoices/{invoiceId}/{action}"].get.responses[
      "200"
    ].content["application/json"],
  ).toBeDefined();
  expect(
    document.paths["/inventory/events"].get.responses["200"].content[
      "text/event-stream"
    ],
  ).toBeDefined();
  const ids = Object.values(document.paths).flatMap((methods) =>
    Object.values(methods as Record<string, { operationId: string }>).map(
      (o) => o.operationId,
    ),
  );
  expect(new Set(ids).size).toBe(ids.length);
});

it("validates every supplied JSON example against its imported transport schema", async () => {
  const document = JSON.parse(await readFile(artifact, "utf8"));
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  let checked = 0;
  for (const methods of Object.values(document.paths)) {
    for (const operation of Object.values(
      methods as Record<
        string,
        {
          requestBody?: { content: object };
          responses: Record<string, { content?: object }>;
        }
      >,
    )) {
      const contents = [
        operation.requestBody?.content,
        ...Object.values(operation.responses).map((r) => r.content),
      ];
      for (const content of contents) {
        const json = (
          content as
            Record<string, { schema: object; example?: unknown }> | undefined
        )?.["application/json"];
        if (json?.example === undefined) continue;
        const validate = ajv.compile({
          ...json.schema,
          components: document.components,
        });
        expect(validate(json.example), JSON.stringify(validate.errors)).toBe(
          true,
        );
        checked++;
      }
    }
  }
  expect(checked).toBeGreaterThan(10);
});
