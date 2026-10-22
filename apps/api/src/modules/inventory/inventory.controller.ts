import { z } from "zod";
import type { RequestHandler } from "express";
import {
  inventoryItemSchema,
  inventoryItemUpdateSchema,
  inventorySupplierSchema,
  inventorySupplierUpdateSchema,
  inventorySettingsSchema,
  inventoryReceiveSchema,
  inventoryConsumeSchema,
  inventoryCorrectionSchema,
} from "@clinic/contracts";
import type { InventoryService } from "./inventory.service.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { authorizedEvents } from "../../middleware/authorized-events.js";
const id = z.uuid().transform((v) => v.toLowerCase());
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly updates: ClinicUpdates,
    private readonly now: () => number,
  ) {}
  projection: RequestHandler = async (req, res) => {
    res.json(await this.service.projection(req.session.actor));
  };
  history: RequestHandler = async (req, res) => {
    res.json(await this.service.history(req.session.actor));
  };
  settings: RequestHandler = async (req, res) => {
    res.json(await this.service.settings(req.session.actor));
  };
  item: RequestHandler = async (req, res) => {
    res.json(
      await this.service.item(
        req.session.actor,
        inventoryItemSchema.parse(req.body),
      ),
    );
  };
  updateItem: RequestHandler = async (req, res) => {
    res.json(
      await this.service.item(
        req.session.actor,
        inventoryItemUpdateSchema.parse(req.body),
        id.parse(req.params.id),
      ),
    );
  };
  supplier: RequestHandler = async (req, res) => {
    res.json(
      await this.service.supplier(
        req.session.actor,
        inventorySupplierSchema.parse(req.body),
      ),
    );
  };
  updateSupplier: RequestHandler = async (req, res) => {
    res.json(
      await this.service.supplier(
        req.session.actor,
        inventorySupplierUpdateSchema.parse(req.body),
        id.parse(req.params.id),
      ),
    );
  };
  receive: RequestHandler = async (req, res) => {
    res.json(
      await this.service.receive(
        req.session.actor,
        inventoryReceiveSchema.parse(req.body),
      ),
    );
  };
  correct: RequestHandler = async (req, res) => {
    res.json(
      await this.service.correct(
        req.session.actor,
        inventoryCorrectionSchema.parse(req.body),
      ),
    );
  };
  consume: RequestHandler = async (req, res) => {
    res.json(
      await this.service.consume(
        req.session.actor,
        inventoryConsumeSchema.parse(req.body),
      ),
    );
  };
  movements: RequestHandler = async (req, res) => {
    res.json(await this.service.movements(req.session.actor));
  };
  changeSettings: RequestHandler = async (req, res) => {
    res.json(
      await this.service.changeSettings(
        req.session.actor,
        inventorySettingsSchema.parse(req.body),
      ),
    );
  };
  events: RequestHandler = (req, res, next) =>
    authorizedEvents(
      this.service.authorize.bind(this.service),
      this.updates,
      this.now,
      "inventory",
    )(req, res, next);
}
