import type { ClinicUpdates } from '../../clinic-updates.js';
import type { IdentityService, Actor } from './identity.service.js';
import { PatientAccessRepository } from './patient-access.repository.js';
import { HistoricalRepository } from './historical.repository.js';
import { captureRemoval } from './historical-capture.js';
export class PatientAccessService {
  constructor(
    private readonly identity: IdentityService,
    private readonly now: () => number,
    private readonly updates: ClinicUpdates,
  ) {}
  candidates(actor: Actor | undefined) {
    return this.identity.withAssigner(actor, (c, tx) =>
      new PatientAccessRepository(tx, c.clinicId).candidates(),
    );
  }
  get(actor: Actor | undefined, id: string) {
    return this.identity.withAssigner(actor, (c, tx) =>
      new PatientAccessRepository(tx, c.clinicId).get(id),
    );
  }
  history(actor: Actor | undefined, id: string) {
    return this.identity.withAssigner(actor, (c, tx) =>
      new PatientAccessRepository(tx, c.clinicId).history(id),
    );
  }
  authorizeStream(actor: Actor | undefined) {
    return this.identity.withAssigner(actor, async (c) => c.clinicId);
  }
  async change(
    actor: Actor | undefined,
    id: string,
    data: {
      commandId: string;
      revision: number;
      accountId: string;
      kind?: 'assigned' | 'shared';
      removalId?: string;
    },
    action: 'share' | 'remove' | 'historical' | 'revoke',
  ) {
    const authorize = action==='historical'||action==='revoke' ? this.identity.withManager.bind(this.identity) : this.identity.withAssigner.bind(this.identity);
    const result = await authorize(actor, async (c, tx) => {
      const changed= await new PatientAccessRepository(tx, c.clinicId).change(
        c.accountId,
        id,
        data,
        action,
        this.now(),
        data.removalId,
      );
      if(changed.removal) {
        const snapshot=await captureRemoval(tx,c.clinicId,id,data.accountId,changed.removal.cutoff);
        await new HistoricalRepository(tx,c.clinicId).capture(changed.removal.id,id,data.accountId,snapshot);
      }
      return {clinicId:c.clinicId,receipt:changed.receipt};
    });
    this.updates.publish(result.clinicId);
    return result.receipt;
  }
}
