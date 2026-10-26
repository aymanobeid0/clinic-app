import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { validationFields, validationSummary } from "@clinic/contracts";
import type { z } from "zod";
import { HttpError } from "../features/identity/identity.api.js";

export function serverFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
) {
  if (!(error instanceof HttpError)) return;
  for (const [path, message] of Object.entries(error.fields))
    form.setError(path as Path<T>, { type: "server", message });
}
export function localFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: z.ZodError,
) {
  for (const [path, message] of Object.entries(validationFields(error)))
    form.setError(path as Path<T>, { type: "validation", message });
  return validationSummary(error);
}
