import type { RequestHandler } from "express";
import { z } from "zod";
import { createExportSchema } from "@clinic/contracts";
import type { ExportsService } from "./exports.service.js";
export class ExportsController {
  constructor(readonly service: ExportsService) {}
  cleanup: RequestHandler = async (req, res) => {
    res.json(await this.service.cleanup(req.session.actor));
  };
  create: RequestHandler = async (req, res) => {
    res
      .status(201)
      .json(
        await this.service.create(
          req.session.actor,
          createExportSchema.parse(req.body),
        ),
      );
  };
  content: RequestHandler = async (req, res) => {
    const value = await this.service.content(
      req.session.actor,
      z.uuid().parse(req.params.id),
    );
    const extension =
      value.receipt.mediaType === "application/zip"
        ? "zip"
        : value.receipt.mediaType === "text/csv"
          ? "csv"
          : "json";
    res.set(
      "Content-Disposition",
      `attachment; filename="export-${value.receipt.id}.${extension}"`,
    );
    res.type(value.receipt.mediaType).send(value.bytes);
  };
}
