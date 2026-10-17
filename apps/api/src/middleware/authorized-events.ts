import type { RequestHandler } from 'express';
import type { Actor } from '../modules/identity/index.js';
import type { ClinicUpdates } from '../clinic-updates.js';
export function authorizedEvents(
  authorize: (actor: Actor | undefined) => Promise<string>,
  updates: ClinicUpdates,
  now: () => number,
  scope?: string | Readonly<Record<string,string>>,
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
    const pendingInvalidations = new Set<string|undefined>();
    let closed = false;
    const verify = async (invalidate: boolean, eventScope?:string) => {
      if (closed) return;
      if (checking) {
        if(invalidate) pendingInvalidations.add(eventScope);
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
            invalidate ? 'event: invalidate\ndata: '+JSON.stringify(eventScope?{scope:eventScope}:{})+'\n\n' : ': heartbeat\n\n',
          );
      } catch {
        if (!closed) res.end();
        cleanup();
      } finally {
        checking = false;
        if (pendingInvalidations.size && !closed) {
          const nextScope=pendingInvalidations.values().next().value;
          pendingInvalidations.delete(nextScope);
          void verify(true,nextScope);
        }
      }
    };
    const unsubscribe = updates.subscribe(clinicId, (changedScope) => {
      if (!changedScope || changedScope === scope || typeof scope==='object' && changedScope in scope) void verify(true,changedScope&&typeof scope==='object'?scope[changedScope]:undefined);
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
