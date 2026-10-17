import type { RequestHandler } from 'express';
import type { Actor } from '../modules/identity/index.js';
import type { ClinicUpdates } from '../clinic-updates.js';
export function authorizedEvents(
  authorize: (actor: Actor | undefined) => Promise<string>,
  updates: ClinicUpdates,
  now: () => number,
  scope?: string,
): RequestHandler {
  return async (req, res) => {
    const actor = req.session.actor;
    const clinicId = await authorize(actor);
    if (res.destroyed || res.writableEnded) return;
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
          now() - req.session.startedAt >= 12 * 60 * 60 * 1000
        )
          throw new Error('Session expired');
        await authorize(req.session.actor);
        if (!closed)
          res.write(
            invalidate ? 'event: invalidate\ndata: {}\n\n' : ': heartbeat\n\n',
          );
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
    const unsubscribe = updates.subscribe(clinicId, (changedScope) => {
      if (!changedScope || changedScope === scope) void verify(true);
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
}
