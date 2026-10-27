import type { RequestHandler } from "express";
import { z } from "zod";
import {
  bookConsultationSchema,
  enterConsultationSchema,
  completeConsultationSchema,
  consultationPriceSchema,
  remunerationSchema,
} from "@clinic/contracts";
import type { ConsultationService } from "./consultation.service.js";
const id = z.uuid().transform((v) => v.toLowerCase());
export class ConsultationController {
  constructor(readonly service: ConsultationService) {}
  price: RequestHandler = async (req, res) => {
    res.json(await this.service.price(req.session.actor));
  };
  setPrice: RequestHandler = async (req, res) => {
    res.json(
      await this.service.setPrice(
        req.session.actor,
        consultationPriceSchema.parse(req.body),
      ),
    );
  };
  setRemuneration: RequestHandler = async (req, res) => {
    res.json(
      await this.service.setRemuneration(
        req.session.actor,
        remunerationSchema.parse(req.body),
      ),
    );
  };
  remunerationHistory: RequestHandler = async (req, res) => {
    res.json(
      await this.service.remunerationHistory(
        req.session.actor,
        id.parse(req.params.doctorId),
      ),
    );
  };
  day: RequestHandler = async (req, res) => {
    res.json(
      await this.service.list(
        req.session.actor,
        null,
        z.iso.date().parse(req.query.date),
      ),
    );
  };
  patient: RequestHandler = async (req, res) => {
    res.json(
      await this.service.list(
        req.session.actor,
        id.parse(req.params.patientId),
      ),
    );
  };
  book: RequestHandler = async (req, res) => {
    res.json(
      await this.service.book(
        req.session.actor,
        id.parse(req.params.patientId),
        bookConsultationSchema.parse(req.body),
      ),
    );
  };
  enter: RequestHandler = async (req, res) => {
    res.json(
      await this.service.care(
        req.session.actor,
        id.parse(req.params.patientId),
        enterConsultationSchema.parse(req.body),
        "entry",
      ),
    );
  };
  complete: RequestHandler = async (req, res) => {
    res.json(
      await this.service.care(
        req.session.actor,
        id.parse(req.params.patientId),
        completeConsultationSchema.parse(req.body),
        "complete",
      ),
    );
  };
  frozen: RequestHandler = async (req, res) => {
    res.json(
      await this.service.frozen(
        req.session.actor,
        id.parse(req.params.patientId),
        id.parse(req.params.consultationId),
      ),
    );
  };
}
