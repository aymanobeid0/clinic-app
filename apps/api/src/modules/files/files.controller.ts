import type { RequestHandler } from "express";
import { z } from "zod";
import {
  attachmentClassSchema,
  attachmentUploadSchema,
  attachmentRemoveSchema,
} from "@clinic/contracts";
import type { FilesService } from "./files.service.js";
import { AppError } from "../../errors/app-error.js";
const uuid = (v: unknown) => z.uuid().parse(v).toLowerCase();
export class FilesController {
  constructor(readonly service: FilesService) {}
  preflight: RequestHandler = async (req, _res, next) => {
    const data = attachmentUploadSchema.parse(req.query);
    await this.service.authorize(
      req.session.actor,
      uuid(req.params.patientId),
      data.classification,
      req.params.attachmentId ? "replace" : "upload",
    );
    next();
  };
  upload: RequestHandler = async (req, res) => {
    if (!Buffer.isBuffer(req.body))
      throw new AppError(400, "Corps binaire PDF, JPEG ou PNG requis.");
    const mediaType =
      req.get("content-type")?.split(";")[0]?.toLowerCase() ?? "";
    res.json(
      await this.service.upload(
        req.session.actor,
        uuid(req.params.patientId),
        req.params.attachmentId ? uuid(req.params.attachmentId) : undefined,
        attachmentUploadSchema.parse(req.query),
        req.body,
        mediaType,
        () => req.aborted || res.destroyed,
      ),
    );
  };
  list: RequestHandler = async (req, res) => {
    res.json(
      await this.service.list(
        req.session.actor,
        uuid(req.params.patientId),
        attachmentClassSchema.parse(req.query.classification),
      ),
    );
  };
  history: RequestHandler = async (req, res) => {
    res.json(
      await this.service.history(
        req.session.actor,
        uuid(req.params.patientId),
        uuid(req.params.attachmentId),
        attachmentClassSchema.parse(req.query.classification),
      ),
    );
  };
  remove: RequestHandler = async (req, res) => {
    res.json(
      await this.service.remove(
        req.session.actor,
        uuid(req.params.patientId),
        uuid(req.params.attachmentId),
        attachmentClassSchema.parse(req.query.classification),
        attachmentRemoveSchema.parse(req.body),
      ),
    );
  };
  content: RequestHandler = async (req, res) => {
    const output = z
      .enum(["inline", "download", "print"])
      .default("inline")
      .parse(req.query.output);
    const result = await this.service.content(
      req.session.actor,
      uuid(req.params.patientId),
      uuid(req.params.attachmentId),
      z.coerce.number().int().positive().parse(req.params.revision),
      attachmentClassSchema.parse(req.query.classification),
      output,
    );
    res.set("Content-Type", result.version.mediaType);
    res.set(
      "Content-Disposition",
      `${output === "download" ? "attachment" : "inline"}; filename="attachment"; filename*=UTF-8''${encodeURIComponent(result.version.name)}`,
    );
    res.set("Content-Security-Policy", "sandbox; default-src 'none'");
    res.send(result.bytes);
  };
}
