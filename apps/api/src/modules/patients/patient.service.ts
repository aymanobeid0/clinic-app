import type { PatientDetails } from '@clinic/contracts';
import { IdentityError, type Actor, type IdentityAccess } from '../identity/index.js';
import { PatientRepository } from './patient.repository.js';
import type { PatientUpdates } from './patient.updates.js';
export class PatientService {
  constructor(
    private readonly identity: IdentityAccess,
    private readonly now: () => number,
    private readonly updates: PatientUpdates,
  ) {}
  async register(actor: Actor | undefined, data: PatientDetails & { commandId: string }) {
    const result = await this.identity.withPermission(
      actor,
      'patients.create',
      async (context, tx) => {
        const repository = new PatientRepository(tx, context.clinicId, context.accountId, this.now);
        const patient = await repository.register(data.commandId, data);
        const duplicates = await repository.duplicates(patient);
        return {
          clinicId: context.clinicId,
          receipt: {
            patient,
            duplicateWarning: duplicates.length > 0,
            duplicates: context.permissions.includes('patients.read') ? duplicates : [],
          },
        };
      },
    );
    this.updates.publish(result.clinicId);
    return result.receipt;
  }
  assignmentSearch(actor: Actor | undefined, q: string, archived: boolean, offset: number) {
    return this.identity.withAssigner(actor, async (context, tx) => ({
      patients: await new PatientRepository(
        tx,
        context.clinicId,
        context.accountId,
        this.now,
      ).search(q, archived, offset),
    }));
  }
  search(actor: Actor | undefined, q: string, archived: boolean, offset: number) {
    return this.identity.withPermission(actor, 'patients.read', async (context, tx) => ({
      patients: await new PatientRepository(
        tx,
        context.clinicId,
        context.accountId,
        this.now,
      ).search(q, archived, offset),
    }));
  }
  get(actor: Actor | undefined, id: string) {
    return this.identity.withPermission(actor, 'patients.read', async (context, tx) => {
      const patient = await new PatientRepository(
        tx,
        context.clinicId,
        context.accountId,
        this.now,
      ).get(id);
      if (!patient) throw new IdentityError(404, 'Patient introuvable.');
      return patient;
    });
  }
  history(actor: Actor | undefined, id: string) {
    return this.identity.withPermission(actor, 'patients.read', async (context, tx) => {
      const repository = new PatientRepository(tx, context.clinicId, context.accountId, this.now);
      if (!(await repository.get(id))) throw new IdentityError(404, 'Patient introuvable.');
      return repository.history(id);
    });
  }
  async change(
    actor: Actor | undefined,
    id: string,
    data: { commandId: string; revision: number },
    action: 'contact' | 'archived' | 'reactivated',
    details?: PatientDetails,
  ) {
    const result = await this.identity.withPermission(
      actor,
      action === 'contact' ? 'patients.edit' : 'patients.archive',
      async (context, tx) => {
        const patient = await new PatientRepository(
          tx,
          context.clinicId,
          context.accountId,
          this.now,
        ).change(id, data.commandId, data.revision, action, details);
        return {
          clinicId: context.clinicId,
          receipt: context.permissions.includes('patients.read')
            ? patient
            : {
                id: patient.id,
                revision: patient.revision,
                archived: patient.archived,
              },
        };
      },
    );
    this.updates.publish(result.clinicId);
    return result.receipt;
  }
  authorizeStream(actor: Actor | undefined) {
    return this.identity.withPermission(
      actor,
      'patients.read',
      async (context) => context.clinicId,
    );
  }
}
