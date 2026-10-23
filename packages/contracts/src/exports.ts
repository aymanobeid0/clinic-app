import { z } from "zod";
const command = z.object({
  commandId: z.uuid(),
});
export const createExportSchema = z.discriminatedUnion("category", [
  command
    .extend({
      category: z.literal("patients"),
      patientId: z.uuid(),
      format: z.enum(["json", "csv"]),
    })
    .strict(),
  command
    .extend({
      category: z.literal("clinical"),
      patientId: z.uuid(),
      format: z.literal("json"),
    })
    .strict(),
  command
    .extend({
      category: z.literal("financial"),
      patientId: z.uuid(),
      format: z.enum(["json", "csv"]),
    })
    .strict(),
  command
    .extend({
      category: z.literal("inventory"),
      format: z.enum(["json", "csv"]),
    })
    .strict(),
  command
    .extend({
      category: z.literal("attachments"),
      patientId: z.uuid(),
      format: z.literal("zip"),
      classification: z.enum(["clinical", "financial", "mixed"]),
      versions: z
        .array(
          z
            .object({ id: z.uuid(), revision: z.number().int().positive() })
            .strict(),
        )
        .min(1)
        .max(25),
    })
    .strict(),
]);
export type ExportRequest = z.infer<typeof createExportSchema>;
export type ExportReceipt = {
  id: string;
  status: "ready";
  expiresAt: string;
  mediaType: string;
  size: number;
  sha256: string;
};
