import type { ClinicUpdates } from '../../clinic-updates.js';
import type { IdentityService, Actor } from './identity.service.js';
import { PatientAccessRepository } from './patient-access.repository.js';
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
    },
    action: 'share' | 'remove',
  ) {
    const result = await this.identity.withAssigner(actor, async (c, tx) => ({
      clinicId: c.clinicId,
      receipt: await new PatientAccessRepository(tx, c.clinicId).change(
        c.accountId,
        id,
        data,
        action,
        this.now(),
      ),
    }));
    this.updates.publish(result.clinicId);
    return result.receipt;
  }
}
