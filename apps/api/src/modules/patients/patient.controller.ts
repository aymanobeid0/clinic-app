import type { RequestHandler } from 'express';
import { registerPatientSchema, editPatientSchema, patientMutationSchema } from '@clinic/contracts';
import { z } from 'zod';
import type { PatientService } from './patient.service.js';
import type { PatientUpdates } from './patient.updates.js';
export class PatientController {
  constructor(
    private readonly service: PatientService,
    private readonly updates: PatientUpdates,
    private readonly now: () => number,
  ) {}
  events: RequestHandler = async (req, res) => {
    const actor = req.session.actor;
    const clinicId = await this.service.authorizeStream(actor);
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'X-Accel-Buffering': 'no',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.flushHeaders();
    let checking = false;
    let pendingInvalidation = false;
    let closed = false;
    const verify = async (invalidate: boolean) => {
      if (closed) return;
      if (checking) {
        pendingInvalidation ||= invalidate;
        return;
      }
      checking = true;
      try {
        await new Promise<void>((resolve, reject) =>
          req.session.reload((error) => (error ? reject(error) : resolve())),
        );
        if (
          !req.session.actor ||
          req.session.actor.accountId !== actor?.accountId ||
          req.session.actor.version !== actor.version ||
          req.session.startedAt === undefined ||
          this.now() - req.session.startedAt >= 12 * 60 * 60 * 1000
        )
          throw new Error('Session expired');
        await this.service.authorizeStream(req.session.actor);
        if (!closed) res.write(invalidate ? 'event: invalidate\ndata: {}\n\n' : ': heartbeat\n\n');
      } catch {
        if (!closed) res.end();
        cleanup();
      } finally {
        checking = false;
        if (pendingInvalidation && !closed) {
          pendingInvalidation = false;
          void verify(true);
        }
      }
    };
    const unsubscribe = this.updates.subscribe(clinicId, () => {
      void verify(true);
    });
    const timer = setInterval(() => {
      void verify(false);
    }, 1000);
    const cleanup = () => {
      closed = true;
      clearInterval(timer);
      unsubscribe();
    };
    res.on('close', cleanup);
    void verify(true);
  };
  register: RequestHandler = async (req, res) => {
    res
      .status(201)
      .json(await this.service.register(req.session.actor, registerPatientSchema.parse(req.body)));
  };
  get: RequestHandler = async (req, res) => {
    res.json(await this.service.get(req.session.actor, z.uuid().parse(req.params.id)));
  };
  history: RequestHandler = async (req, res) => {
    res.json(await this.service.history(req.session.actor, z.uuid().parse(req.params.id)));
  };
  contact: RequestHandler = async (req, res) => {
    const data = editPatientSchema.parse(req.body);
    res.json(
      await this.service.change(
        req.session.actor,
        z.uuid().parse(req.params.id),
        data,
        'contact',
        data,
      ),
    );
  };
  archive: RequestHandler = async (req, res) => {
    res.json(
      await this.service.change(
        req.session.actor,
        z.uuid().parse(req.params.id),
        patientMutationSchema.parse(req.body),
        'archived',
      ),
    );
  };
  reactivate: RequestHandler = async (req, res) => {
    res.json(
      await this.service.change(
        req.session.actor,
        z.uuid().parse(req.params.id),
        patientMutationSchema.parse(req.body),
        'reactivated',
      ),
    );
  };
  search: RequestHandler = async (req, res) => {
    const query = z
      .object({
        q: z.string().trim().max(120).default(''),
        archived: z.enum(['true', 'false']).default('false'),
        offset: z.coerce.number().int().min(0).max(2147483647).default(0),
      })
      .parse(req.query);
    res.json(
      await this.service.search(
        req.session.actor,
        query.q,
        query.archived === 'true',
        query.offset,
      ),
    );
  };
}
