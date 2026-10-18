import { PatientAccessRepository } from './patient-access.repository.js';
import {
  clinicalEligible,
  clinicalPermissions,
  type ClinicalPermission,
} from './clinical-access.policy.js';

import { onboardingStage } from './account-readiness.policy.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hash, verify } from 'argon2';
import type { Identity, SignIn, recoveryIdentitySchema } from '@clinic/contracts';
import { provisionClinicSchema } from '@clinic/contracts';
import type { z } from 'zod';
import {
  IdentityRepository,
  type IdentityTransaction,
  type ManagerAccount,
} from './identity.repository.js';

export type Actor = { clinicId: string; accountId: string; version: number };
export type Mail = {
  sendRecovery?(message: { to: string; token: string; recoveryUrl: string }): Promise<void>;
  sendNotification?(message: { to: string; subject: string }): Promise<void>;
  sendVerification(message: { to: string; token: string; verificationUrl: string }): Promise<void>;
};
export class IdentityError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const DAY = 24 * 60 * 60 * 1000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export class IdentityService {
  private readonly dummyHash = hash(randomBytes(32).toString('hex'));

  constructor(
    private readonly repository: IdentityRepository,
    private readonly now: () => number,
    private readonly origin: string,
    private readonly mail?: Mail,
    private readonly updates?: ClinicUpdates,
  ) {}

  async provisionClinic(input: z.input<typeof provisionClinicSchema>) {
    const data = provisionClinicSchema.parse(input);
    return this.repository.provision({
      ...data,
      passwordHash: await hash(data.temporaryPassword),
      temporaryExpiresAt: new Date(this.now() + DAY),
    });
  }

  async signIn(input: SignIn) {
    const account =
      input.method === 'email'
        ? await this.repository.findEmailAccount(input.email)
        : await this.repository.findLoginAccount(input.clinicCode, input.username);
    const valid = await verify(account?.passwordHash ?? (await this.dummyHash), input.password);
    if (!valid || !account || account.loginMethod !== input.method || this.isUnavailable(account)) {
      throw new IdentityError(401, 'Identifiants invalides.');
    }
    return {
      actor: {
        clinicId: account.clinicId,
        accountId: account.id,
        version: account.credentialVersion,
      },
      stage: onboardingStage(account),
    };
  }

  private async notify(to: string, subject: string) {
    if (!this.mail?.sendNotification)
      throw new IdentityError(503, 'Service de notification non configuré.');
    try {
      await this.mail.sendNotification({ to, subject });
    } catch {
      throw new IdentityError(503, 'Envoi impossible. Réessayez.');
    }
  }
  async changeEmail(actor: Actor | undefined, currentPassword: string, email: string) {
    if (!this.mail) throw new IdentityError(503, 'Service de courriel non configuré.');
    const token = randomBytes(32).toString('hex');
    const tokenHash = digest(token);
    const recipient = await this.withReadyAccount(actor, async (account, tx) => {
      if (!account.isManager && account.loginMethod !== 'email')
        throw new IdentityError(403, 'Compte responsable requis.');
      if (!(await verify(account.passwordHash, currentPassword)))
        throw new IdentityError(401, 'Mot de passe incorrect.');
      if (account.verifiedEmail === email) throw new IdentityError(409, 'Adresse déjà vérifiée.');
      if (!this.mail?.sendNotification)
        throw new IdentityError(503, 'Service de notification non configuré.');
      await tx.saveVerification(account.id, email, tokenHash, new Date(this.now() + DAY));
      return account;
    });
    try {
      await this.mail.sendVerification({
        to: email,
        token,
        verificationUrl: `${this.origin}/#verification=${token}`,
      });
    } catch {
      await this.repository.invalidateUndeliveredVerification(
        recipient.clinicId,
        recipient.id,
        tokenHash,
      );
      throw new IdentityError(503, 'Envoi impossible. Réessayez.');
    }
  }
  async changePassword(actor: Actor | undefined, currentPassword: string, password: string) {
    const passwordHash = await hash(password);
    return this.withReadyAccount(actor, async (account, tx) => {
      if (!(await verify(account.passwordHash, currentPassword)))
        throw new IdentityError(401, 'Mot de passe incorrect.');
      if (await verify(account.passwordHash, password))
        throw new IdentityError(400, 'Choisissez un nouveau mot de passe.');
      await tx.replacePassword(account.id, passwordHash);
    });
  }
  private locate(identity: z.infer<typeof recoveryIdentitySchema>) {
    return identity.method === 'email'
      ? this.repository.findEmailAccount(identity.email)
      : this.repository.findLoginAccount(identity.clinicCode, identity.username);
  }
  private recoverable(account: ManagerAccount | null) {
    if (!account || !account.isManager || account.disabled || account.historicalOnly)
      throw new IdentityError(400, 'Récupération invalide.');
    return account;
  }
  async recoverCode(
    identity: z.infer<typeof recoveryIdentitySchema>,
    code: string,
    password: string,
  ) {
    const located = await this.locate(identity);
    const a = this.recoverable(located);
    const passwordHash = await hash(password);
    return this.repository.withAccount(a.clinicId, a.id, async (account, tx) => {
      const current = this.recoverable(account);
      if (!(await tx.hasCode(current.id, digest(code))))
        throw new IdentityError(400, 'Récupération invalide.');
      if (current.verifiedEmail)
        await this.notify(current.verifiedEmail, 'Récupération de votre compte');
      const recovered = await tx.consumeRecovery(current, passwordHash);
      return {
        clinicId: recovered.clinicId,
        accountId: recovered.id,
        version: recovered.credentialVersion,
      };
    });
  }
  async requestRecovery(identity: z.infer<typeof recoveryIdentitySchema>) {
    if (!this.mail?.sendRecovery)
      throw new IdentityError(503, 'Service de courriel non configuré.');
    const located = await this.locate(identity);
    if (
      !located ||
      !located.isManager ||
      located.disabled ||
      located.historicalOnly ||
      !located.verifiedEmail
    )
      return;
    const token = randomBytes(32).toString('hex');
    const tokenHash = digest(token);
    const recipient = await this.repository.withAccount(
      located.clinicId,
      located.id,
      async (account, tx) => {
        if (
          !account ||
          !account.isManager ||
          account.disabled ||
          account.historicalOnly ||
          !account.verifiedEmail
        )
          return null;
        await tx.saveRecovery(account.id, tokenHash, new Date(this.now() + 30 * 60 * 1000));
        return account.verifiedEmail;
      },
    );
    if (!recipient) return;
    try {
      await this.mail.sendRecovery({
        to: recipient,
        token,
        recoveryUrl: `${this.origin}/#recovery=${token}`,
      });
    } catch {
      await this.repository.withAccount(located.clinicId, located.id, async (_a, tx) =>
        tx.invalidateRecovery(located.id, tokenHash),
      );
      return;
    }
  }
  async recoverEmail(
    identity: z.infer<typeof recoveryIdentitySchema>,
    token: string,
    password: string,
  ) {
    const a = this.recoverable(await this.locate(identity));
    const passwordHash = await hash(password);
    return this.repository.withAccount(a.clinicId, a.id, async (account, tx) => {
      const current = this.recoverable(account);
      if (
        current.recoveryHash !== digest(token) ||
        !current.recoveryExpiresAt ||
        current.recoveryExpiresAt.getTime() <= this.now()
      )
        throw new IdentityError(400, 'Lien invalide ou expiré.');
      const recovered = await tx.consumeRecovery(current, passwordHash);
      return {
        clinicId: recovered.clinicId,
        accountId: recovered.id,
        version: recovered.credentialVersion,
      };
    });
  }
  getIdentity(actor: Actor | undefined) {
    return this.withAuthenticatedAccount(actor, async (account) => ({
      accountId: account.id,
      clinicId: account.clinicId,
      username: account.username,
      loginMethod: account.loginMethod as Identity['loginMethod'],
      isManager: account.isManager,
      kind: account.kind as Identity['kind'],
      permissions: account.permissions,
      historicalOnly: account.historicalOnly,
      recoverySetup: account.recoverySetup,
      loginEmail: account.loginEmail,
      displayName: account.displayName,
      stage: onboardingStage(account),
    }));
  }

  withReadyAccount<T>(
    actor: Actor | undefined,
    action: (account: ManagerAccount, transaction: IdentityTransaction) => Promise<T>,
  ) {
    return this.withAuthenticatedAccount(actor, async (account, transaction) => {
      if (onboardingStage(account) !== 'ready' || account.historicalOnly)
        throw new IdentityError(403, 'Accès limité.');
      return action(account, transaction);
    });
  }

  withAssigner<T>(
    actor: Actor | undefined,
    action: (
      context: { clinicId: string; accountId: string },
      tx: import('../../database.js').ClinicTransaction,
    ) => Promise<T>,
  ) {
    return this.withReadyAccount(actor, (account, transaction) => {
      if (!account.isManager && !account.permissions.includes('patients.assign'))
        throw new IdentityError(403, 'Autorisation d’attribution requise.');
      return transaction.databaseTransaction((tx) =>
        action({ clinicId: account.clinicId, accountId: account.id }, tx),
      );
    });
  }

  withMedicationReference<T>(
    actor: Actor | undefined,
    action: (
      context: { clinicId: string; accountId: string },
      tx: import("../../database.js").ClinicTransaction,
    ) => Promise<T>,
    manage = true,
  ) {
    return this.withReadyAccount(actor, (account, transaction) => {
      if (
        !account.isManager &&
        !(
          account.kind === "doctor" &&
          clinicalEligible(account, "prescriptions.sign")
        ) &&
        !(!manage && clinicalEligible(account, "prescriptions.draft"))
      )
        throw new IdentityError(403, "Gestion des médicaments non autorisée.");
      return transaction.databaseTransaction((tx) =>
        action({ clinicId: account.clinicId, accountId: account.id }, tx),
      );
    });
  }
  withCatalogRead<T>(actor:Actor|undefined, action:(context:{clinicId:string;accountId:string;permissions:readonly string[];isManager:boolean},tx:import('../../database.js').ClinicTransaction)=>Promise<T>) {
    return this.withReadyAccount(actor,(account,transaction)=> {
      if (!account.permissions.includes('catalog.manage') && !clinicalEligible(account,'clinical.read')) throw new IdentityError(403,'Accès au catalogue non autorisé.');
      return transaction.databaseTransaction(tx=>action({clinicId:account.clinicId,accountId:account.id,permissions:account.permissions,isManager:account.isManager},tx));
    });
  }
  withClinicalPatients<T>(
    actor: Actor | undefined,
    action: (
      context: { clinicId: string; accountId: string; patientIds: string[] },
      tx: import('../../database.js').ClinicTransaction,
    ) => Promise<T>,
  ) {
    return this.withReadyAccount(actor, (account, transaction) =>
      transaction.databaseTransaction(async (tx) => {
        if (!clinicalEligible(account, 'clinical.read'))
          throw new IdentityError(403, 'Accès clinique non autorisé.');
        const patientIds = await new PatientAccessRepository(tx, account.clinicId)
          .activePatientIds(account.id);
        return action(
          {
            clinicId: account.clinicId,
            accountId: account.id,
            patientIds,
          },
          tx,
        );
      }),
    );
  }
  withClinicalPermission<T>(
    actor: Actor | undefined,
    patientId: string,
    permission: ClinicalPermission,
    action: (
      context: { clinicId: string; accountId: string; patientId: string; permissions: readonly string[]; isManager:boolean },
      tx: import('../../database.js').ClinicTransaction,
    ) => Promise<T>,
  ) {
    return this.withReadyAccount(actor, (account, transaction) =>
      transaction.databaseTransaction(async (tx) => {
        if (
          !clinicalPermissions.includes(permission) ||
          !clinicalEligible(account, permission) ||
          !(await new PatientAccessRepository(tx, account.clinicId).active(patientId, account.id))
        )
          throw new IdentityError(403, 'Accès clinique non autorisé.');
        return action({ clinicId: account.clinicId, accountId: account.id, patientId, permissions: account.permissions, isManager:account.isManager }, tx);
      }),
    );
  }

  withManager<T>(
    actor: Actor | undefined,
    action: (
      context: { clinicId: string; accountId: string },
      tx: import("../../database.js").ClinicTransaction,
    ) => Promise<T>,
  ) {
    return this.withReadyAccount(actor, (account, transaction) => {
      if (!account.isManager)
        throw new IdentityError(403, "Autorité de responsable requise.");
      return transaction.databaseTransaction((tx) =>
        action({ clinicId: account.clinicId, accountId: account.id }, tx),
      );
    });
  }
  withPermissionOrManager<T>(
    actor: Actor | undefined,
    permission: string,
    action: (
      context: { clinicId: string; accountId: string },
      tx: import("../../database.js").ClinicTransaction,
    ) => Promise<T>,
  ) {
    return this.withReadyAccount(actor, (account, transaction) => {
      if (!account.isManager && !account.permissions.includes(permission))
        throw new IdentityError(403, "Autorisation requise.");
      if ((clinicalPermissions as readonly string[]).includes(permission))
        throw new IdentityError(
          403,
          "Une autorisation clinique par patient est requise.",
        );
      return transaction.databaseTransaction((tx) =>
        action({ clinicId: account.clinicId, accountId: account.id }, tx),
      );
    });
  }
  withPermission<T>(
    actor: Actor | undefined,
    permission: string,
    action: (
      context: {
        clinicId: string;
        accountId: string;
        permissions: readonly string[];
      },
      tx: import('../../database.js').ClinicTransaction,
    ) => Promise<T>,
  ) {
    return this.withReadyAccount(actor, (account, transaction) => {
      if ((clinicalPermissions as readonly string[]).includes(permission))
        throw new IdentityError(403, 'Une autorisation clinique par patient est requise.');
      if (!account.permissions.includes(permission))
        throw new IdentityError(403, 'Autorisation requise.');
      return transaction.databaseTransaction((tx) =>
        action(
          {
            clinicId: account.clinicId,
            accountId: account.id,
            permissions: account.permissions,
          },
          tx,
        ),
      );
    });
  }

  getClinic(actor: Actor | undefined) {
    return this.withReadyAccount(actor, (account, tx) => tx.getClinic(account.clinicId));
  }
  async replaceTemporaryPassword(actor: Actor | undefined, password: string) {
    const passwordHash = await hash(password);
    await this.withAuthenticatedAccount(actor, async (account, transaction) => {
      if (!account.temporaryExpiresAt) {
        throw new IdentityError(409, 'Mot de passe déjà remplacé.');
      }
      if (await verify(account.passwordHash, password)) {
        throw new IdentityError(400, 'Choisissez un nouveau mot de passe.');
      }
      await transaction.replacePassword(account.id, passwordHash);
    });
    this.updates?.publish(actor!.clinicId);
  }

  async sendEmailVerification(actor: Actor | undefined, email: string) {
    if (!this.mail) throw new IdentityError(503, 'Service de courriel non configuré.');
    const token = randomBytes(32).toString('hex');
    const tokenHash = digest(token);
    const recipient = await this.withAuthenticatedAccount(actor, async (account, transaction) => {
      if (onboardingStage(account) !== 'email') {
        throw new IdentityError(409, 'Étape de configuration incorrecte.');
      }
      if (
        account.loginMethod === 'email' &&
        !account.recoverySetup &&
        email !== account.loginEmail
      ) {
        throw new IdentityError(400, 'Vérifiez votre adresse de connexion.');
      }
      await transaction.saveVerification(account.id, email, tokenHash, new Date(this.now() + DAY));
      return { clinicId: account.clinicId, accountId: account.id };
    });
    try {
      await this.mail.sendVerification({
        to: email,
        token,
        verificationUrl: `${this.origin}/#verification=${token}`,
      });
    } catch {
      await this.repository.invalidateUndeliveredVerification(
        recipient.clinicId,
        recipient.accountId,
        tokenHash,
      );
      throw new IdentityError(503, 'Envoi impossible. Réessayez.');
    }
  }

  async verifyEmail(actor: Actor | undefined, token: string) {
    const result = await this.withAuthenticatedAccount(actor, async (account, transaction) => {
      const valid =
        (onboardingStage(account) === 'email' || onboardingStage(account) === 'ready') &&
        account.recoveryEmail &&
        account.verificationHash === digest(token) &&
        account.verificationExpiresAt &&
        account.verificationExpiresAt.getTime() > this.now();
      if (!valid || !account.recoveryEmail) {
        throw new IdentityError(400, 'Lien invalide ou expiré.');
      }
      const changed =
        account.verifiedEmail !== null && account.verifiedEmail !== account.recoveryEmail;
      const loginChanged =
        account.loginMethod === 'email' && account.loginEmail !== account.recoveryEmail;
      if (loginChanged) await transaction.replaceLoginEmail(account.id, account.recoveryEmail);
      if (
        account.recoverySetup &&
        account.recoveryNotificationEmail &&
        account.recoveryNotificationEmail !== account.recoveryEmail
      )
        await this.notify(account.recoveryNotificationEmail, 'Adresse de récupération remplacée');
      await transaction.verifyEmail(account.id, account.recoveryEmail);
      if (changed && account.verifiedEmail) {
        await this.notify(account.verifiedEmail, 'Adresse courriel modifiée');
        if (!loginChanged) await transaction.revokeSessions(account.id);
        return null;
      }
      return account.isManager ? this.issueCodes(account, transaction) : null;
    });
    this.updates?.publish(actor!.clinicId);
    return result;
  }

  regenerateCodes(actor: Actor | undefined, password: string) {
    return this.withAuthenticatedAccount(actor, async (account, transaction) => {
      if (
        !account.isManager ||
        account.historicalOnly ||
        !account.verifiedEmail ||
        account.temporaryExpiresAt
      ) {
        throw new IdentityError(409, 'Vérifiez votre adresse courriel.');
      }
      if (!(await verify(account.passwordHash, password))) {
        throw new IdentityError(401, 'Mot de passe incorrect.');
      }
      return this.issueCodes(account, transaction);
    });
  }

  async confirmSavedCodes(actor: Actor | undefined, batchId: string) {
    await this.withAuthenticatedAccount(actor, async (account, transaction) => {
      if (
        !account.isManager ||
        account.historicalOnly ||
        !account.verifiedEmail ||
        account.temporaryExpiresAt ||
        account.codesBatchId !== batchId
      ) {
        throw new IdentityError(409, 'Codes remplacés ou configuration incomplète.');
      }
      await transaction.confirmSavedCodes(account.id);
    });
    this.updates?.publish(actor!.clinicId);
  }

  private isUnavailable(account: ManagerAccount) {
    return (
      account.disabled ||
      (account.temporaryExpiresAt !== null && account.temporaryExpiresAt.getTime() <= this.now())
    );
  }

  private withAuthenticatedAccount<T>(
    actor: Actor | undefined,
    action: (account: ManagerAccount, transaction: IdentityTransaction) => Promise<T>,
  ) {
    if (!actor) throw new IdentityError(401, 'Connexion requise.');
    return this.repository.withAccount(
      actor.clinicId,
      actor.accountId,
      async (account, transaction) => {
        if (
          !account ||
          this.isUnavailable(account) ||
          account.credentialVersion !== actor.version
        ) {
          throw new IdentityError(401, 'Connexion requise.');
        }
        return action(account, transaction);
      },
    );
  }

  private async issueCodes(account: ManagerAccount, transaction: IdentityTransaction) {
    const codes = Array.from({ length: 10 }, () => randomBytes(16).toString('hex'));
    const batchId = randomUUID();
    await transaction.replaceRecoveryCodes(account, batchId, codes.map(digest));
    return { codes, batchId };
  }
}
