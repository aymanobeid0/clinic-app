import type { FieldErrors } from "react-hook-form";
import { fieldSummary } from "@clinic/contracts";

export function FormErrors({ errors }: { errors: FieldErrors }) {
  const messages: Record<string, string> = {};
  function collect(value: unknown, path: string[], depth: number) {
    if (
      !value ||
      typeof value !== "object" ||
      depth > 12 ||
      Object.keys(messages).length >= 20
    )
      return;
    const entry = value as Record<string, unknown>;
    if (typeof entry.message === "string") {
      messages[path.join(".")] = entry.message;
      return;
    }
    for (const [key, child] of Object.entries(entry))
      if (!["ref", "types", "type"].includes(key))
        collect(child, [...path, key], depth + 1);
  }
  collect(errors, [], 0);
  return Object.keys(messages).length ? (
    <p role="alert">{fieldSummary(messages)}</p>
  ) : null;
}
