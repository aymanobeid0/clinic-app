import { hash, verify } from 'argon2';
import type { z } from 'zod';
import type { createAccountSchema } from '@clinic/contracts';
import { summarizeAccount, AccountTransaction } from './account.repository.js';
import { IdentityError, type Actor, type IdentityService } from './identity.service.js';
import type { ManagerAccount } from './identity.repository.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
export class AccountService {
  constructor(
    private readonly identity: IdentityService,
    private readonly now: () => number,
    private readonly updates: ClinicUpdates,
  ) {}
  private async run<T>(
    actor: Actor | undefined,
    password: string | undefined,
    action: (account: ManagerAccount, tx: AccountTransaction) => Promise<T>,
  ) {
    const result = await this.identity.withReadyAccount(actor, async (account, transaction) => {
      if (!account.isManager) throw new IdentityError(403, 'Autorité responsable requise.');
      if (password !== undefined && !(await verify(account.passwordHash, password)))
        throw new IdentityError(401, 'Mot de passe incorrect.');
      return action(account, transaction.accounts(account.clinicId));
    });
    if (password !== undefined) this.updates.publish(actor!.clinicId);
    return result;
  }
  list(actor: Actor | undefined) {
    return this.run(actor, undefined, (_a, tx) => tx.list());
  }
  async create(actor: Actor | undefined, data: z.infer<typeof createAccountSchema>) {
    const passwordHash = await hash(data.temporaryPassword);
    return this.run(actor, data.currentPassword, async (_a, tx) => {
      const result = await tx.create(data, passwordHash, new Date(this.now() + 86400000));
      if (!result) throw new IdentityError(409, 'Identifiant réservé.');
      return result;
    });
  }
  private target<T>(
    actor: Actor | undefined,
    id: string,
    password: string,
    revision: number,
    action: (target: ManagerAccount, tx: AccountTransaction, actor: ManagerAccount) => Promise<T>,
  ) {
    return this.run(actor, password, async (a, tx) => {
      const target = await tx.find(id);
      if (!target) throw new IdentityError(404, 'Compte introuvable.');
      if (target.revision !== revision)
        throw new IdentityError(
          409,
          'Ce compte a été modifié. Rechargez et réconciliez vos modifications.',
        );
      return action(target, tx, a);
    });
  }
  private async protectLast(a: ManagerAccount, tx: AccountTransaction) {
    if (
      a.isManager &&
      !a.disabled &&
      !a.historicalOnly &&
      !a.temporaryExpiresAt &&
      a.verifiedEmail &&
      a.codesSaved &&
      (await tx.readyManagers()) <= 1
    )
      throw new IdentityError(409, 'Conservez un responsable actif configuré.');
  }
  rename(
    actor: Actor | undefined,
    id: string,
    password: string,
    revision: number,
    username: string,
  ) {
    return this.target(actor, id, password, revision, async (a, tx) => {
      const result = await tx.rename(a, username);
      if (!result) throw new IdentityError(409, 'Identifiant réservé.');
      return result;
    });
  }
  permissions(
    actor: Actor | undefined,
    id: string,
    password: string,
    revision: number,
    permissions: string[],
  ) {
    return this.target(actor, id, password, revision, (a, tx) =>
      tx.permissions(a.id, [...new Set(permissions)]),
    );
  }
  kind(actor: Actor | undefined, id: string, password: string, revision: number, kind: string) {
    return this.target(actor, id, password, revision, (a, tx) => tx.kind(a.id, kind));
  }
  manager(
    actor: Actor | undefined,
    id: string,
    password: string,
    revision: number,
    isManager: boolean,
  ) {
    return this.target(actor, id, password, revision, async (a, tx) => {
      if (a.isManager === isManager) return summarizeAccount(a);
      if (!isManager) await this.protectLast(a, tx);
      return tx.manager(a.id, isManager);
    });
  }
  status(
    actor: Actor | undefined,
    id: string,
    password: string,
    revision: number,
    status: 'active' | 'historical' | 'disabled',
  ) {
    return this.target(actor, id, password, revision, async (a, tx) => {
      if (status !== 'active') await this.protectLast(a, tx);
      return tx.status(a.id, status);
    });
  }
  async reset(
    actor: Actor | undefined,
    id: string,
    password: string,
    revision: number,
    temporaryPassword: string,
  ) {
    const passwordHash = await hash(temporaryPassword);
    return this.target(actor, id, password, revision, async (a, tx, manager) => {
      if (a.id === manager.id)
        throw new IdentityError(403, 'Un autre responsable doit réinitialiser votre compte.');
      await this.protectLast(a, tx);
      await tx.reset(a.id, passwordHash, new Date(this.now() + 86400000), a);
    });
  }
}
