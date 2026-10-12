import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hash, verify } from 'argon2';
import type { Identity, SignIn } from '@clinic/contracts';
import { provisionClinicSchema } from '@clinic/contracts';
import type { z } from 'zod';
import {
  IdentityRepository,
  type IdentityTransaction,
  type ManagerAccount,
} from './identity.repository.js';

export type Actor = { clinicId: string; accountId: string; version: number };
export type Mail = {
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

function onboardingStage(account: ManagerAccount): Identity['stage'] {
  if (account.temporaryExpiresAt) return 'password';
  if (!account.verifiedEmail && (account.isManager || account.loginMethod === 'email'))
    return 'email';
  if (account.isManager && !account.codesSaved) return 'codes';
  return 'ready';
}

export class IdentityService {
  private readonly dummyHash = hash(randomBytes(32).toString('hex'));

  constructor(
    private readonly repository: IdentityRepository,
    private readonly now: () => number,
    private readonly origin: string,
    private readonly mail?: Mail,
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

  getIdentity(actor: Actor | undefined) {
    return this.withAuthenticatedAccount(actor, async (account) => ({
      accountId: account.id,
      clinicId: account.clinicId,
      username: account.username,
      loginMethod: account.loginMethod as Identity['loginMethod'],
      isManager: account.isManager,
      loginEmail: account.loginEmail,
      displayName: account.displayName,
      stage: onboardingStage(account),
    }));
  }

  getClinic(actor: Actor | undefined) {
    return this.withAuthenticatedAccount(actor, async (account, transaction) => {
      if (onboardingStage(account) !== 'ready') {
        throw new IdentityError(403, 'Terminez la configuration.');
      }
      return transaction.getClinic(account.clinicId);
    });
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
  }

  async sendEmailVerification(actor: Actor | undefined, email: string) {
    if (!this.mail) throw new IdentityError(503, 'Service de courriel non configuré.');
    const token = randomBytes(32).toString('hex');
    const tokenHash = digest(token);
    const recipient = await this.withAuthenticatedAccount(actor, async (account, transaction) => {
      if (onboardingStage(account) !== 'email') {
        throw new IdentityError(409, 'Étape de configuration incorrecte.');
      }
      if (account.loginMethod === 'email' && email !== account.loginEmail) {
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

  verifyEmail(actor: Actor | undefined, token: string) {
    return this.withAuthenticatedAccount(actor, async (account, transaction) => {
      const valid =
        onboardingStage(account) === 'email' &&
        account.recoveryEmail &&
        account.verificationHash === digest(token) &&
        account.verificationExpiresAt &&
        account.verificationExpiresAt.getTime() > this.now();
      if (!valid || !account.recoveryEmail) {
        throw new IdentityError(400, 'Lien invalide ou expiré.');
      }
      await transaction.verifyEmail(account.id, account.recoveryEmail);
      return account.isManager ? this.issueCodes(account, transaction) : null;
    });
  }

  regenerateCodes(actor: Actor | undefined, password: string) {
    return this.withAuthenticatedAccount(actor, async (account, transaction) => {
      if (!account.isManager || !account.verifiedEmail || account.temporaryExpiresAt) {
        throw new IdentityError(409, 'Vérifiez votre adresse courriel.');
      }
      if (!(await verify(account.passwordHash, password))) {
        throw new IdentityError(401, 'Mot de passe incorrect.');
      }
      return this.issueCodes(account, transaction);
    });
  }

  confirmSavedCodes(actor: Actor | undefined, batchId: string) {
    return this.withAuthenticatedAccount(actor, async (account, transaction) => {
      if (
        !account.isManager ||
        !account.verifiedEmail ||
        account.temporaryExpiresAt ||
        account.codesBatchId !== batchId
      ) {
        throw new IdentityError(409, 'Codes remplacés ou configuration incomplète.');
      }
      await transaction.confirmSavedCodes(account.id);
    });
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
