import type { ProcedureStart } from '@clinic/contracts';
import type { ClinicTransaction } from '../../database.js';
import { VisitRepository } from './visit.repository.js';
import { createProcedureCharge } from '../billing/index.js';

/** Settled start boundary for #20: the caller owns the authorized transaction.
 * Add billing's full agreed charge inside this transaction, using event.id as
 * its unique source. Never publish or independently commit the financial half.
 * The retained event includes exact accepted price, discount, extras and actor.
 */
export async function recordProcedureStart(
  tx: ClinicTransaction,
  clinicId: string,
  event: ProcedureStart,
) {
  await new VisitRepository(tx, clinicId).start(event);
  await createProcedureCharge(tx, clinicId, event);
}
