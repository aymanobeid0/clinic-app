import { AccountTransaction } from './account.repository.js';
import type { Database } from '../../database.js';
import type { Account, Prisma } from '../../generated/prisma/client.js';

// Account data stays inside the API; controllers return explicit transport fields.
export type ManagerAccount = Account;

type ProvisionRecord = {
  email: string;
  clinicCode: string;
  clinicName: string;
  username: string;
  displayName: string;
  passwordHash: string;
  temporaryExpiresAt: Date;
};

export class IdentityTransaction {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  accounts(clinicId: string) {
    return new AccountTransaction(this.tx, clinicId);
  }

  replacePassword(accountId: string, passwordHash: string) {
    return this.tx.account.update({
      where: { id: accountId },
      data: {
        passwordHash,
        temporaryExpiresAt: null,
        credentialVersion: { increment: 1 },
      },
    });
  }

  saveVerification(accountId: string, email: string, tokenHash: string, expiresAt: Date) {
    return this.tx.account.update({
      where: { id: accountId },
      data: {
        recoveryEmail: email,
        verificationHash: tokenHash,
        verificationExpiresAt: expiresAt,
      },
    });
  }

  verifyEmail(accountId: string, email: string) {
    return this.tx.account.update({
      where: { id: accountId },
      data: {
        verifiedEmail: email,
        recoverySetup: false,
        recoveryNotificationEmail: null,
        verificationHash: null,
        verificationExpiresAt: null,
      },
    });
  }

  async replaceRecoveryCodes(account: ManagerAccount, batchId: string, hashes: string[]) {
    await this.tx.recoveryCode.deleteMany({
      where: { clinicId: account.clinicId, accountId: account.id },
    });
    await this.tx.recoveryCode.createMany({
      data: hashes.map((hash) => ({
        clinicId: account.clinicId,
        accountId: account.id,
        hash,
      })),
    });
    await this.tx.account.update({
      where: { id: account.id },
      data: { codesBatchId: batchId, codesSaved: false },
    });
  }

  async consumeRecovery(account: ManagerAccount, passwordHash: string) {
    await this.tx.recoveryCode.deleteMany({
      where: { clinicId: account.clinicId, accountId: account.id },
    });
    return this.tx.account.update({
      where: { id: account.id },
      data: {
        passwordHash,
        temporaryExpiresAt: null,
        credentialVersion: { increment: 1 },
        verifiedEmail: null,
        recoverySetup: true,
        recoveryNotificationEmail: account.verifiedEmail ?? account.recoveryNotificationEmail,
        codesSaved: false,
        codesBatchId: null,
        recoveryHash: null,
        recoveryExpiresAt: null,
        verificationHash: null,
        verificationExpiresAt: null,
      },
    });
  }
  hasCode(accountId: string, hash: string) {
    return this.tx.recoveryCode.findFirst({ where: { accountId, hash } });
  }
  saveRecovery(accountId: string, recoveryHash: string, recoveryExpiresAt: Date) {
    return this.tx.account.update({
      where: { id: accountId },
      data: { recoveryHash, recoveryExpiresAt },
    });
  }
  invalidateRecovery(accountId: string, recoveryHash: string) {
    return this.tx.account.updateMany({
      where: { id: accountId, recoveryHash },
      data: { recoveryHash: null, recoveryExpiresAt: null },
    });
  }
  revokeSessions(accountId: string) {
    return this.tx.account.update({
      where: { id: accountId },
      data: { credentialVersion: { increment: 1 } },
    });
  }
  replaceLoginEmail(accountId: string, loginEmail: string) {
    return this.tx.account.update({
      where: { id: accountId },
      data: { loginEmail, credentialVersion: { increment: 1 } },
    });
  }
  confirmSavedCodes(accountId: string) {
    return this.tx.account.update({
      where: { id: accountId },
      data: { codesSaved: true },
    });
  }

  getClinic(clinicId: string) {
    return this.tx.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: { code: true, name: true },
    });
  }
}

export class IdentityRepository {
  constructor(private readonly database: Database) {}

  provision(record: ProvisionRecord) {
    return this.database.client.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: { code: record.clinicCode, name: record.clinicName },
      });
      const account = await tx.account.create({
        data: {
          clinicId: clinic.id,
          username: record.username,
          loginMethod: 'email',
          loginEmail: record.email,
          recoveryEmail: record.email,
          isManager: true,
          displayName: record.displayName,
          passwordHash: record.passwordHash,
          temporaryExpiresAt: record.temporaryExpiresAt,
        },
      });
      await tx.reservedUsername.create({
        data: {
          clinicId: clinic.id,
          accountId: account.id,
          username: account.username,
        },
      });
      return { clinicCode: clinic.code };
    });
  }

  findEmailAccount(email: string) {
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.login_email', ${email}, true)`;
      return tx.account.findUnique({ where: { loginEmail: email } });
    });
  }

  findLoginAccount(clinicCode: string, username: string) {
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.clinic_code', ${clinicCode}, true)`;
      const clinic = await tx.clinic.findUnique({
        where: { code: clinicCode },
      });
      if (!clinic) return null;
      await tx.$queryRaw`SELECT set_config('app.clinic_id', ${clinic.id}, true)`;
      return tx.account.findUnique({
        where: { clinicId_username: { clinicId: clinic.id, username } },
      });
    });
  }

  // All account workflows use one scoped transaction and lock. The callback
  // cannot accidentally run an account mutation on another pooled connection.
  withAccount<T>(
    clinicId: string,
    accountId: string,
    action: (account: ManagerAccount | null, transaction: IdentityTransaction) => Promise<T>,
  ) {
    return this.database.clinicTransaction(clinicId, async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinicId}, 0))::text`;
      await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId}::uuid FOR UPDATE`;
      const account = await tx.account.findUnique({ where: { id: accountId } });
      return action(account, new IdentityTransaction(tx));
    });
  }

  invalidateUndeliveredVerification(clinicId: string, accountId: string, tokenHash: string) {
    return this.database.clinicTransaction(clinicId, (tx) =>
      tx.account.updateMany({
        where: { id: accountId, verificationHash: tokenHash },
        data: { verificationHash: null, verificationExpiresAt: null },
      }),
    );
  }
}
