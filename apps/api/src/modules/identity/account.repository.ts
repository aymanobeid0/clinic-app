import type { z } from 'zod';
import type { AccountSummary, createAccountSchema } from '@clinic/contracts';
import type { Account, Prisma } from '../../generated/prisma/client.js';
import { randomUUID } from 'node:crypto';
export function summarizeAccount(a: Account): AccountSummary {
  return {
    id: a.id,
    revision: a.revision,
    username: a.username,
    displayName: a.displayName,
    kind: a.kind as AccountSummary['kind'],
    isManager: a.isManager,
    disabled: a.disabled,
    historicalOnly: a.historicalOnly,
    permissions: a.permissions,
    contactEmail: a.contactEmail,
    phone: a.phone,
  };
}
export class AccountTransaction {
  constructor(
    private readonly tx: Prisma.TransactionClient,
    private readonly clinicId: string,
  ) {}
  async list() {
    return (
      await this.tx.account.findMany({
        where: { clinicId: this.clinicId },
        orderBy: { username: 'asc' },
      })
    ).map(summarizeAccount);
  }
  find(id: string) {
    return this.tx.account.findFirst({
      where: { id, clinicId: this.clinicId },
    });
  }
  async create(
    data: z.infer<typeof createAccountSchema>,
    passwordHash: string,
    temporaryExpiresAt: Date,
  ) {
    const reserved = await this.tx.reservedUsername.findUnique({
      where: {
        clinicId_username: { clinicId: this.clinicId, username: data.username },
      },
    });
    if (reserved) return null;
    const account = await this.tx.account.create({
      data: {
        clinicId: this.clinicId,
        username: data.username,
        displayName: data.displayName,
        kind: data.kind,
        contactEmail: data.contactEmail,
        phone: data.phone,

        passwordHash,
        temporaryExpiresAt,
      },
    });
    await this.tx.reservedUsername.create({
      data: {
        id: randomUUID(),
        clinicId: this.clinicId,
        accountId: account.id,
        username: account.username,
      },
    });
    return summarizeAccount(account);
  }
  async rename(account: Account, username: string) {
    const reserved = await this.tx.reservedUsername.findUnique({
      where: { clinicId_username: { clinicId: this.clinicId, username } },
    });
    if (reserved && reserved.accountId !== account.id) return null;
    if (!reserved)
      await this.tx.reservedUsername.create({
        data: { clinicId: this.clinicId, accountId: account.id, username },
      });
    return summarizeAccount(
      await this.tx.account.update({
        where: { id: account.id },
        data: { revision: { increment: 1 }, username, credentialVersion: { increment: 1 } },
      }),
    );
  }
  async readyManagers() {
    return this.tx.account.count({
      where: {
        clinicId: this.clinicId,
        isManager: true,
        disabled: false,
        historicalOnly: false,
        temporaryExpiresAt: null,
        verifiedEmail: { not: null },
        codesSaved: true,
      },
    });
  }
  async permissions(id: string, permissions: string[]) {
    return summarizeAccount(
      await this.tx.account.update({
        where: { id },
        data: { revision: { increment: 1 }, permissions },
      }),
    );
  }
  async kind(id: string, kind: string) {
    return summarizeAccount(
      await this.tx.account.update({
        where: { id },
        data: { revision: { increment: 1 }, kind, credentialVersion: { increment: 1 } },
      }),
    );
  }
  async manager(id: string, isManager: boolean) {
    await this.tx.recoveryCode.deleteMany({
      where: { accountId: id, clinicId: this.clinicId },
    });
    return summarizeAccount(
      await this.tx.account.update({
        where: { id },
        data: {
          revision: { increment: 1 },
          isManager,
          codesSaved: false,
          codesBatchId: null,
          recoveryHash: null,
          recoveryExpiresAt: null,
          verificationHash: null,
          verificationExpiresAt: null,
          credentialVersion: { increment: 1 },
        },
      }),
    );
  }
  async status(id: string, status: 'active' | 'historical' | 'disabled') {
    return summarizeAccount(
      await this.tx.account.update({
        where: { id },
        data: {
          revision: { increment: 1 },
          disabled: status === 'disabled',
          historicalOnly: status === 'historical',
          credentialVersion: { increment: 1 },
        },
      }),
    );
  }
  async reset(id: string, passwordHash: string, temporaryExpiresAt: Date, account: Account) {
    if (account.isManager)
      await this.tx.recoveryCode.deleteMany({
        where: { accountId: id, clinicId: this.clinicId },
      });
    await this.tx.account.update({
      where: { id },
      data: {
        revision: { increment: 1 },
        passwordHash,
        temporaryExpiresAt,
        credentialVersion: { increment: 1 },
        recoveryHash: null,
        recoveryExpiresAt: null,
        verificationHash: null,
        verificationExpiresAt: null,
        ...(account.isManager
          ? {
              verifiedEmail: null,
              recoverySetup: true,
              recoveryNotificationEmail: account.verifiedEmail ?? account.recoveryNotificationEmail,
              codesSaved: false,
              codesBatchId: null,
            }
          : {}),
      },
    });
  }
}
