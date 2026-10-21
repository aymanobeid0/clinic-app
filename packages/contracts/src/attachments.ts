import { z } from "zod";
export const attachmentClassSchema = z.enum(["clinical", "financial", "mixed"]);
export type AttachmentClass = z.infer<typeof attachmentClassSchema>;
export const attachmentUploadSchema = z.object({
  commandId: z.uuid(),
  classification: attachmentClassSchema,
  name: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[^\x00-\x1f\x7f/\\]+$/),
  revision: z.coerce.number().int().min(1).optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
});
export const attachmentRemoveSchema = z.object({
  commandId: z.uuid(),
  revision: z.number().int().min(1),
  reason: z.string().trim().min(1).max(1000),
});
export type AttachmentVersion = {
  id: string;
  patientId: string;
  revision: number;
  classification: AttachmentClass;
  name: string;
  mediaType: string;
  size: number;
  sha256: string;
  actorId: string;
  at: string;
  reason: string;
};
export type AttachmentRecord = AttachmentVersion & {
  removed: boolean;
  events: AttachmentEvent[];
  versions: AttachmentVersion[];
};
export type AttachmentList = { attachments:AttachmentVersion[]; usage:AttachmentUsage };
export type AttachmentEvent = {
  actorId: string;
  at: string;
  action: "upload" | "replace" | "remove";
  revision: number;
  reason: string;
};
export type AttachmentUsage = {
  retainedBytes: number;
  reservedBytes: number;
  limitBytes: 2000000000;
  fileLimitBytes: 20000000;
};
