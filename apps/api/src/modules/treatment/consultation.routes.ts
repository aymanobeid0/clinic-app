import { Router } from "express";
import { z } from "zod";
import {
  bookConsultationSchema,
  enterConsultationSchema,
  completeConsultationSchema,
  consultationPriceSchema,
  remunerationSchema,
} from "@clinic/contracts";
import type { ConsultationService } from "./consultation.service.js";
export function consultationRoutes(service: ConsultationService) {
  const r = Router();
  r.get("/consultation-settings/price", async (req, res) => {
    res.json(await service.price(req.session.actor));
  });
  r.post("/consultation-settings/price", async (req, res) => {
    res.json(
      await service.setPrice(
        req.session.actor,
        consultationPriceSchema.parse(req.body),
      ),
    );
  });
  r.post("/consultation-settings/remuneration", async (req, res) => {
    res.json(
      await service.setRemuneration(
        req.session.actor,
        remunerationSchema.parse(req.body),
      ),
    );
  });
  r.get("/consultation-settings/remuneration/:doctorId", async (req, res) => {
    res.json(
      await service.remunerationHistory(
        req.session.actor,
        z.uuid().parse(req.params.doctorId),
      ),
    );
  });
  r.get("/consultations", async (req, res) => {
    res.json(
      await service.list(
        req.session.actor,
        null,
        z.iso.date().parse(req.query.date),
      ),
    );
  });
  r.get("/consultations/:patientId", async (req, res) => {
    res.json(
      await service.list(
        req.session.actor,
        z.uuid().parse(req.params.patientId),
      ),
    );
  });
  r.post("/consultations/:patientId", async (req, res) => {
    res.json(
      await service.book(
        req.session.actor,
        z.uuid().parse(req.params.patientId),
        bookConsultationSchema.parse(req.body),
      ),
    );
  });
  r.post("/consultations/:patientId/entry", async (req, res) => {
    res.json(
      await service.care(
        req.session.actor,
        z.uuid().parse(req.params.patientId),
        enterConsultationSchema.parse(req.body),
        "entry",
      ),
    );
  });
  r.post("/consultations/:patientId/complete", async (req, res) => {
    res.json(
      await service.care(
        req.session.actor,
        z.uuid().parse(req.params.patientId),
        completeConsultationSchema.parse(req.body),
        "complete",
      ),
    );
  });
  r.get(
    "/consultations/:patientId/:consultationId/remuneration",
    async (req, res) => {
      res.json(
        await service.frozen(
          req.session.actor,
          z.uuid().parse(req.params.patientId),
          z.uuid().parse(req.params.consultationId),
        ),
      );
    },
  );
  return r;
}
