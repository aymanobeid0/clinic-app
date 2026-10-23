import { createHash } from "node:crypto";
import {
  createExportSchema,
  type ExportRequest,
  type ExportReceipt,
} from "@clinic/contracts";
import type { Actor, IdentityAccess } from "../identity/index.js";
import { AppError } from "../../errors/app-error.js";
import { ExportsRepository } from "./exports.repository.js";
import { captureClinical, boundClinicalExport } from "../clinical/index.js";
import { captureTreatment, boundTreatmentExport } from "../treatment/index.js";
import { exportBilling, boundBillingExport } from "../billing/index.js";
import { exportInventory, boundInventoryExport } from "../inventory/index.js";
import {
  exportAttachments,
  captureAttachments,
  boundAttachmentsExport,
  type PrivateFileStore,
} from "../files/index.js";
import { csv, zip } from "./serialization.js";
import { exportPatient, capturePatient } from "../patients/index.js";
const hash = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");
export class ExportsService {
  constructor(
    readonly identity: IdentityAccess,
    readonly now: () => number,
    readonly store?: PrivateFileStore,
  ) {}
  cleanup(actor: Actor | undefined) {
    return this.identity.withExportAccount(actor, async (c, tx) => ({
      deleted: (
        await new ExportsRepository(tx, c.clinicId, c.accountId).cleanup(
          new Date(this.now()),
        )
      ).count,
    }));
  }
  async create(
    actor: Actor | undefined,
    request: ExportRequest,
  ): Promise<ExportReceipt> {
    return this.identity.withExportScope(actor, request, async (c, tx) => {
      const r = new ExportsRepository(tx, c.clinicId, c.accountId);
      const prior = await r.find(request.commandId);
      if (prior) {
        if (prior.requestHash !== hash(JSON.stringify(request)))
          throw new AppError(409, "Commande déjà utilisée.");
        this.available(prior, c.stamp);
        return this.receipt(prior);
      }
      await r.cleanup(new Date(this.now()));
      if (request.category === "clinical")
        await boundClinicalExport(tx, c.clinicId, request.patientId);
      if (request.category === "clinical")
        await boundAttachmentsExport(tx, c.clinicId, request.patientId);
      if (request.category === "clinical" || request.category === "financial")
        await boundTreatmentExport(tx, c.clinicId, request.patientId);
      if (request.category === "financial")
        await boundBillingExport(tx, c.clinicId, request.patientId);
      if (request.category === "inventory")
        await boundInventoryExport(tx, c.clinicId);
      let data: unknown;
      let entries: { name: string; bytes: Buffer }[] = [];
      switch (request.category) {
        case "patients":
          data = await exportPatient(tx, c.clinicId, request.patientId);
          break;
        case "clinical": {
          const patient = await capturePatient(
            tx,
            c.clinicId,
            request.patientId,
          );
          data = {
            patient: patient
              ? {
                  id: patient.id,
                  patientNumber: patient.patientNumber,
                  name: patient.name,
                }
              : null,
            clinical: await captureClinical(tx, c.clinicId, request.patientId),
            ...(await captureTreatment(
              tx,
              c.clinicId,
              request.patientId,
              await captureAttachments(
                tx,
                c.clinicId,
                request.patientId,
                c.canReadFinancialFiles,
              ),
            )),
          };
          break;
        }
        case "financial":
          data = await exportBilling(tx, c, request.patientId);
          break;
        case "inventory":
          data = await exportInventory(tx, c.clinicId, c.accountId, this.now);
          break;
        case "attachments": {
          const files = await exportAttachments(
            tx,
            c.clinicId,
            request,
            this.store,
          );
          entries = files.map(({ name, bytes }) => ({ name, bytes }));
          data = {
            patientId: request.patientId,
            files: files.map(({ name, version }) => ({
              path: name,
              ...version,
            })),
          };
          break;
        }
      }
      const document = {
        schemaVersion: 1,
        generatedAt: new Date(this.now()).toISOString(),
        category: request.category,
        data,
      };
      const bytes =
        request.format === "csv"
          ? csv(document)
          : request.format === "zip"
            ? zip([
                ...entries,
                {
                  name: "manifest.json",
                  bytes: Buffer.from(JSON.stringify(document)),
                },
              ])
            : Buffer.from(JSON.stringify(document));
      if (bytes.length > 26_000_000)
        throw new AppError(
          413,
          "Export trop volumineux. Réduisez la sélection.",
        );
      await r.capacity(bytes.length);
      const mediaType =
        request.format === "csv"
          ? "text/csv"
          : request.format === "zip"
            ? "application/zip"
            : "application/json";
      const value = await r.save({
        id: request.commandId,
        clinicId: c.clinicId,
        accountId: c.accountId,
        request,
        requestHash: hash(JSON.stringify(request)),
        stamp: c.stamp,
        bytes: Uint8Array.from(bytes),
        mediaType,
        sha256: hash(bytes),
        expiresAt: new Date(this.now() + 15 * 60_000),
      });
      return this.receipt(value);
    });
  }
  private receipt(v: {
    id: string;
    expiresAt: Date;
    mediaType: string;
    sha256: string;
    bytes: Uint8Array;
  }): ExportReceipt {
    return {
      id: v.id,
      status: "ready",
      expiresAt: v.expiresAt.toISOString(),
      mediaType: v.mediaType,
      size: v.bytes.length,
      sha256: v.sha256,
    };
  }
  private available(v: { stamp: string; expiresAt: Date }, stamp: string) {
    if (v.expiresAt.getTime() <= this.now())
      throw new AppError(410, "Export expiré.");
    if (v.stamp !== stamp)
      throw new AppError(403, "Périmètre modifié. Créez un nouvel export.");
  }
  async content(actor: Actor | undefined, id: string) {
    const value = await this.identity.withExportAccount(actor, async (c, tx) =>
      new ExportsRepository(tx, c.clinicId, c.accountId).find(id),
    );
    if (!value) throw new AppError(404, "Export introuvable.");
    return this.identity.withExportScope(
      actor,
      createExportSchema.parse(value.request),
      async (c) => {
        this.available(value, c.stamp);
        if (hash(Buffer.from(value.bytes)) !== value.sha256)
          throw new AppError(503, "Intégrité de l’export invalide.");
        return {
          bytes: Buffer.from(value.bytes),
          receipt: this.receipt(value),
        };
      },
    );
  }
}
