import { authorizedEvents } from '../../middleware/authorized-events.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import {
  clinicalDraftSchema,
  clinicalConfirmSchema,
  chartDraftSchema,
  noteDraftSchema,
} from '@clinic/contracts';
import type { ClinicalService } from './clinical.service.js';
import type { NoteService } from './note.service.js';
export class ClinicalController {
  constructor(
    private readonly service: ClinicalService,
    private readonly notesService: NoteService,
    private readonly updates: ClinicUpdates,
    private readonly now: () => number,
  ) {}
  notes: RequestHandler = async (req, res) => {
    res.json(
      await this.notesService.list(
        req.session.actor,
        z
          .uuid()
          .transform((v) => v.toLowerCase())
          .parse(req.params.id),
      ),
    );
  };
  noteEvents: RequestHandler = (req, res, next) => {
    const id = z
      .uuid()
      .transform((v) => v.toLowerCase())
      .parse(req.params.id);
    return authorizedEvents(
      (a) => this.service.authorizeStream(a, id),
      this.updates,
      this.now,
      `notes:${id}`,
    )(req, res, next);
  };
  note: RequestHandler = async (req, res) => {
    res.json(
      await this.notesService.get(
        req.session.actor,
        z
          .uuid()
          .transform((v) => v.toLowerCase())
          .parse(req.params.id),
        z
          .uuid()
          .transform((v) => v.toLowerCase())
          .parse(req.params.visitId),
      ),
    );
  };
  noteChange: RequestHandler = async (req, res) => {
    const action = z.enum(['draft', 'finalize']).parse(req.params.action);
    res.json(
      await this.notesService.change(
        req.session.actor,
        z
          .uuid()
          .transform((v) => v.toLowerCase())
          .parse(req.params.id),
        z
          .uuid()
          .transform((v) => v.toLowerCase())
          .parse(req.params.visitId),
        action,
        (action === 'draft' ? noteDraftSchema : clinicalConfirmSchema).parse(
          req.body,
        ),
      ),
    );
  };
  patients: RequestHandler = async (req, res) => {
    res.json(await this.service.patients(req.session.actor));
  };
  discoveryEvents: RequestHandler = (req, res, next) =>
    authorizedEvents(
      this.service.authorizeDiscovery.bind(this.service),
      this.updates,
      this.now,
    )(req, res, next);
  events: RequestHandler = (req, res, next) =>
    authorizedEvents(
      (a) =>
        this.service.authorizeStream(
          a,
          z
            .uuid()
            .transform((v) => v.toLowerCase())
            .parse(req.params.id),
        ),
      this.updates,
      this.now,
      {['prescriptions:'+String(req.params.id).toLowerCase()]:'prescriptions',medications:'medications',['suggestions:'+String(req.params.id).toLowerCase()]:'suggestions'},
    )(req, res, next);
  get: RequestHandler = async (req, res) => {
    res.json(
      await this.service.get(
        req.session.actor,
        z
          .uuid()
          .transform((v) => v.toLowerCase())
          .parse(req.params.id),
      ),
    );
  };
  draft: RequestHandler = async (req, res) => {
    res.json(
      await this.service.change(
        req.session.actor,
        z
          .uuid()
          .transform((v) => v.toLowerCase())
          .parse(req.params.id),
        z.enum(['history', 'chart']).parse(req.params.kind),
        'draft',
        (req.params.kind === 'chart'
          ? chartDraftSchema
          : clinicalDraftSchema
        ).parse(req.body),
      ),
    );
  };
  confirm: RequestHandler = async (req, res) => {
    res.json(
      await this.service.change(
        req.session.actor,
        z
          .uuid()
          .transform((v) => v.toLowerCase())
          .parse(req.params.id),
        z.enum(['history', 'chart']).parse(req.params.kind),
        'confirm',
        clinicalConfirmSchema.parse(req.body),
      ),
    );
  };
}
