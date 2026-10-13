import type { RequestHandler } from 'express';
import { z } from 'zod';
import {
  createAccountSchema,
  permissionsSchema,
  renameAccountSchema,
  accountKindChangeSchema,
  managerAuthoritySchema,
  accountStatusSchema,
  resetAccountSchema,
} from '@clinic/contracts';
import type { AccountService } from './account.service.js';
export class AccountController {
  constructor(private readonly service: AccountService) {}
  private id(value: unknown) {
    return z.uuid().parse(value);
  }
  list: RequestHandler = async (req, res) => {
    res.json(await this.service.list(req.session.actor));
  };
  create: RequestHandler = async (req, res) => {
    res
      .status(201)
      .json(await this.service.create(req.session.actor, createAccountSchema.parse(req.body)));
  };
  rename: RequestHandler = async (req, res) => {
    const d = renameAccountSchema.parse(req.body);
    res.json(
      await this.service.rename(
        req.session.actor,
        this.id(req.params.id),
        d.currentPassword,
        d.revision,
        d.username,
      ),
    );
  };
  permissions: RequestHandler = async (req, res) => {
    const d = permissionsSchema.parse(req.body);
    res.json(
      await this.service.permissions(
        req.session.actor,
        this.id(req.params.id),
        d.currentPassword,
        d.revision,
        d.permissions,
      ),
    );
  };
  kind: RequestHandler = async (req, res) => {
    const d = accountKindChangeSchema.parse(req.body);
    res.json(
      await this.service.kind(
        req.session.actor,
        this.id(req.params.id),
        d.currentPassword,
        d.revision,
        d.kind,
      ),
    );
  };
  manager: RequestHandler = async (req, res) => {
    const d = managerAuthoritySchema.parse(req.body);
    res.json(
      await this.service.manager(
        req.session.actor,
        this.id(req.params.id),
        d.currentPassword,
        d.revision,
        d.isManager,
      ),
    );
  };
  status: RequestHandler = async (req, res) => {
    const d = accountStatusSchema.parse(req.body);
    res.json(
      await this.service.status(
        req.session.actor,
        this.id(req.params.id),
        d.currentPassword,
        d.revision,
        d.status,
      ),
    );
  };
  reset: RequestHandler = async (req, res) => {
    const d = resetAccountSchema.parse(req.body);
    await this.service.reset(
      req.session.actor,
      this.id(req.params.id),
      d.currentPassword,
      d.revision,
      d.temporaryPassword,
    );
    res.status(204).end();
  };
}
