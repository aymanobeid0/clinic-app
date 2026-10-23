import ts from "typescript";
import { fileURLToPath } from "node:url";

export type Schema = { [key: string]: unknown };

/** Convert the existing JSON transport shapes using the installed TS compiler.
 * Unsupported shapes fail generation; no private model schema or runtime adapter.
 */
export function responseSchemas(): Record<string, Schema> {
  const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    process.cwd(),
  );
  const path = fileURLToPath(new URL("./responses.ts", import.meta.url));
  // Include the app's declaration-merging roots (session/Express augmentation).
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const file = program.getSourceFile(path)!;
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics.slice(0, 8), {
        getCanonicalFileName: (p) => p,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine: () => "\n",
      }),
    );
  const roots = new Map<string, ts.Type>();
  for (const statement of file.statements) {
    if (!ts.isTypeAliasDeclaration(statement)) continue;
    for (const property of checker.getPropertiesOfType(
      checker.getTypeAtLocation(statement),
    )) {
      roots.set(
        property.name,
        checker.getTypeOfSymbolAtLocation(
          property,
          property.valueDeclaration ?? statement,
        ),
      );
    }
  }
  const names = new Map([...roots].map(([name, type]) => [type, name]));
  const encode = (type: ts.Type, depth = 0): Schema => {
    if (depth && names.has(type))
      return { $ref: `#/components/schemas/${names.get(type)}` };
    if (depth > 50)
      throw new Error(
        "Recursive/non-JSON response requires an explicit transport schema.",
      );
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
      throw new Error(
        `Unspecified response type: ${checker.typeToString(type)}`,
      );
    }
    if (type.flags & ts.TypeFlags.StringLiteral)
      return { type: "string", const: (type as ts.StringLiteralType).value };
    if (type.flags & ts.TypeFlags.NumberLiteral)
      return { type: "number", const: (type as ts.NumberLiteralType).value };
    if (type.flags & ts.TypeFlags.BooleanLiteral)
      return { type: "boolean", const: checker.typeToString(type) === "true" };
    if (type.flags & ts.TypeFlags.String) return { type: "string" };
    if (type.flags & ts.TypeFlags.Number) return { type: "number" };
    if (type.flags & ts.TypeFlags.Boolean) return { type: "boolean" };
    if (type.flags & ts.TypeFlags.Null) return { type: "null" };
    if (type.isUnion()) {
      const variants = type.types.filter(
        (t) => !(t.flags & ts.TypeFlags.Undefined),
      );
      return variants.length === 1
        ? encode(variants[0], depth + 1)
        : { anyOf: variants.map((t) => encode(t, depth + 1)) };
    }
    if (checker.isArrayType(type)) {
      return {
        type: "array",
        items: encode(
          checker.getTypeArguments(type as ts.TypeReference)[0],
          depth + 1,
        ),
      };
    }
    if (type.getCallSignatures().length)
      throw new Error("Functions cannot be response data.");
    const properties: Record<string, Schema> = {};
    const required: string[] = [];
    for (const property of checker.getPropertiesOfType(type)) {
      const field = checker.getTypeOfSymbolAtLocation(
        property,
        property.valueDeclaration ?? file,
      );
      properties[property.name] = encode(field, depth + 1);
      if (!(property.flags & ts.SymbolFlags.Optional))
        required.push(property.name);
    }
    if (!Object.keys(properties).length)
      throw new Error(`Unsupported response: ${checker.typeToString(type)}`);
    return { type: "object", properties, required };
  };
  const result: Record<string, Schema> = {};
  for (const [name, type] of roots) {
    try {
      result[name] = encode(type);
    } catch (cause) {
      throw new Error(
        `Response ${name} needs an explicit JSON transport type.`,
        { cause },
      );
    }
  }
  return result;
}
