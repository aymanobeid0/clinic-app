import { authorizedEvents } from "../../middleware/authorized-events.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import type { SuggestionService } from "./suggestion.service.js";
import type { PrescriptionService } from "./prescription.service.js";
import type { RequestHandler } from "express";
import { z } from "zod";
import {
  medicationCommandSchema,
  prescriptionTemplateSchema,
  prescriptionDraftSchema,
  clinicalConfirmSchema,
  chartSuggestionSchema,
} from "@clinic/contracts";
import type { MedicationService } from "./medication.service.js";
export class PrescriptionController {
  constructor(
    readonly medications: MedicationService,
    readonly prescriptions: PrescriptionService,
    readonly suggestions: SuggestionService,
    readonly updates: ClinicUpdates,
    readonly now: () => number,
  ) {}
  events: RequestHandler = (req, res, next) =>
    authorizedEvents(
      this.medications.authorize.bind(this.medications),
      this.updates,
      this.now,
      "medications",
    )(req, res, next);
  suggestionsList: RequestHandler = async (req, res) => {
    res.json(
      await this.suggestions.list(
        req.session.actor,
        this.id(req.params.patientId),
      ),
    );
  };
  suggestionChange: RequestHandler = async (req, res) => {
    res.json(
      await this.suggestions.change(
        req.session.actor,
        this.id(req.params.patientId),
        this.id(req.params.suggestionId),
        chartSuggestionSchema.parse(req.body),
      ),
    );
  };
  private id(value: unknown) {
    return z
      .uuid()
      .transform((v) => v.toLowerCase())
      .parse(value);
  }
  prescriptionsList: RequestHandler = async (req, res) => {
    res.json(
      await this.prescriptions.list(
        req.session.actor,
        this.id(req.params.patientId),
      ),
    );
  };
  prescription: RequestHandler = async (req, res) => {
    res.json(
      await this.prescriptions.get(
        req.session.actor,
        this.id(req.params.patientId),
        this.id(req.params.prescriptionId),
      ),
    );
  };
  print: RequestHandler = async (req, res) => {
    res.json(
      await this.prescriptions.print(
        req.session.actor,
        this.id(req.params.patientId),
        this.id(req.params.prescriptionId),
        z.coerce.number().int().positive().parse(req.params.revision),
      ),
    );
  };
  change: RequestHandler = async (req, res) => {
    const action = z.enum(["draft", "finalize"]).parse(req.params.action);
    res.json(
      await this.prescriptions.change(
        req.session.actor,
        this.id(req.params.patientId),
        this.id(req.params.prescriptionId),
        action,
        (action === "draft"
          ? prescriptionDraftSchema
          : clinicalConfirmSchema
        ).parse(req.body),
      ),
    );
  };
  list: RequestHandler = async (req, res) => {
    res.json(
      await this.medications.list(
        req.session.actor,
        z
          .string()
          .max(160)
          .parse(req.query.q ?? ""),
        req.query.retired === "true",
      ),
    );
  };
  save: RequestHandler = async (req, res) => {
    res.json(
      await this.medications.save(
        req.session.actor,
        medicationCommandSchema.parse(req.body),
      ),
    );
  };
  template: RequestHandler = async (req, res) => {
    res.json(await this.medications.template(req.session.actor));
  };
  saveTemplate: RequestHandler = async (req, res) => {
    res.json(
      await this.medications.saveTemplate(
        req.session.actor,
        prescriptionTemplateSchema.parse(req.body),
      ),
    );
  };
}
