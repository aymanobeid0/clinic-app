import { AppError } from '../../errors/app-error.js';
import { createHash } from 'node:crypto';
import type { PatientAccess, AssignmentCandidate, PatientAccessEvent } from '@clinic/contracts';
import type { ClinicTransaction } from '../../database.js';

import { clinicalEligible } from './clinical-access.policy.js';
import { HistoricalRepository } from './historical.repository.js';
export class PatientAccessRepository {
  constructor(
    private readonly tx: ClinicTransaction,
    private readonly clinicId: string,
  ) {}
  async activePatientIds(accountId:string) {
    const grants=await this.tx.patientGrant.findMany({where:{clinicId:this.clinicId,accountId,active:true},select:{patientId:true}});
    return grants.map(g=>g.patientId);
  }
  async exists(patientId: string) {
    return !!(await this.tx.patient.findFirst({
      where: { clinicId: this.clinicId, id: patientId },
      select: { id: true },
    }));
  }
  async active(patientId: string, accountId: string) {
    return !!(await this.tx.patientGrant.findFirst({
      where: { clinicId: this.clinicId, patientId, accountId, active: true },
    }));
  }
  async candidates(): Promise<AssignmentCandidate[]> {
    const accounts = await this.tx.account.findMany({
      where: { clinicId: this.clinicId },
      orderBy: { displayName: 'asc' },
    });
    return accounts
      .filter((a) => clinicalEligible(a))
      .map((a) => ({
        id: a.id,
        displayName: a.displayName,
        kind: a.kind as 'doctor' | 'staff',
      }));
  }
  async get(patientId: string): Promise<PatientAccess> {
    if (!(await this.exists(patientId))) throw new AppError(404, 'Patient introuvable.');
    const state = await this.tx.patientAccessState.findUnique({
      where: { clinicId_patientId: { clinicId: this.clinicId, patientId } },
    });
    const grants = await this.tx.patientGrant.findMany({
      where: { clinicId: this.clinicId, patientId, active: true },
      orderBy: { accountId: 'asc' },
    });
    const accounts = await this.tx.account.findMany({
      where: {
        clinicId: this.clinicId,
        id: { in: grants.map((g) => g.accountId) },
      },
    });
    return {
      patientId,
      revision: state?.revision ?? 0,
      grants: grants.map((g) => ({
        accountId: g.accountId,
        displayName: accounts.find((a) => a.id === g.accountId)!.displayName,
        kind: g.kind as 'assigned' | 'shared',
      })),
    };
  }
  async history(patientId: string): Promise<PatientAccessEvent[]> {
    await this.get(patientId);
    const rows = await this.tx.patientAccessHistory.findMany({
      where: { clinicId: this.clinicId, patientId },
      orderBy: { at: 'asc' },
    });
    rows.sort(
      (a, b) =>
        (a.snapshot as unknown as PatientAccess).revision -
        (b.snapshot as unknown as PatientAccess).revision,
    );
    const accounts = await this.tx.account.findMany({
      where: {
        clinicId: this.clinicId,
        id: { in: [...new Set(rows.flatMap((row) => [row.actorId, row.accountId]))] },
      },
      select: { id: true, displayName: true },
    });
    const names = new Map(accounts.map((account) => [account.id, account.displayName]));
    return rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      accountId: r.accountId,
      actorDisplayName: names.get(r.actorId)!,
      accountDisplayName: names.get(r.accountId)!,
      action: r.action,
      at: r.at.toISOString(),
      snapshot: r.snapshot as unknown as PatientAccess,
    }));
  }
  async change(
    actorId: string,
    patientId: string,
    data: {
      commandId: string;
      revision: number;
      accountId: string;
      kind?: 'assigned' | 'shared';
    },
    action: 'share' | 'remove' | 'historical' | 'revoke',
    now: number,
    removalId?: string,
  ) {
    // Preserve durable share/remove retry hashes from before historical grants.
    const payload:unknown[]=[patientId,data.accountId,data.revision,action,data.kind ?? null];
    if(action==='historical') payload.push(removalId ?? null);
    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const old = await this.tx.patientAccessHistory.findUnique({
      where: {
        clinicId_commandId: {
          clinicId: this.clinicId,
          commandId: data.commandId,
        },
      },
    });
    if (old) {
      if (old.actorId !== actorId || old.payloadHash !== hash)
        throw new AppError(409, 'Commande déjà utilisée.');
      return {receipt:old.snapshot as unknown as PatientAccess,removal:null};
    }
    const current = await this.get(patientId);
    if (current.revision !== data.revision)
      throw new AppError(409, 'Les accès ont changé. Rechargez et confirmez votre choix.');
    const target = await this.tx.account.findFirst({
      where: { clinicId: this.clinicId, id: data.accountId },
    });
    if (!target) throw new AppError(404, 'Compte introuvable.');
    if (action === 'share' && !clinicalEligible(target))
      throw new AppError(403, 'Compte non éligible aux soins.');
    if (action === 'remove' && !(await this.active(patientId, data.accountId)))
      throw new AppError(409, 'Accès déjà retiré.');
    const historical = new HistoricalRepository(this.tx,this.clinicId);
    const eventId = crypto.randomUUID();
    if(action==='historical') {
      if(target.kind!=='doctor' || target.disabled || await this.active(patientId,data.accountId))
        throw new AppError(403,'Ancien médecin sans accès actif requis.');
      const removal=removalId && await historical.removal(patientId,data.accountId,removalId);
      const last=await this.tx.patientAccessHistory.findMany({where:{clinicId:this.clinicId,patientId,accountId:data.accountId,action:{in:['share','remove','revoke']}},orderBy:{at:'desc'}});
      const latest=last.sort((a,b)=>(b.snapshot as unknown as PatientAccess).revision-(a.snapshot as unknown as PatientAccess).revision)[0];
      if(!removal || latest?.id!==removalId || latest.action!=='remove')
        throw new AppError(409,'Retrait courant avec instantané conservé requis.');
      await historical.grant(patientId,data.accountId,removalId!);
    } else {
      await historical.revoke(patientId,data.accountId);
    }
    if(action!=='historical') {
    await this.tx.patientGrant.upsert({
      where: {
        clinicId_patientId_accountId: {
          clinicId: this.clinicId,
          patientId,
          accountId: data.accountId,
        },
      },
      create: {
        clinicId: this.clinicId,
        patientId,
        accountId: data.accountId,
        kind: data.kind ?? 'shared',
        active: action === 'share',
      },
      update: {
        active: action === 'share',
        ...(data.kind ? { kind: data.kind } : {}),
      },
    });
    }
    await this.tx.patientAccessState.upsert({
      where: { clinicId_patientId: { clinicId: this.clinicId, patientId } },
      create: { clinicId: this.clinicId, patientId, revision: 1 },
      update: { revision: { increment: 1 } },
    });
    const result = await this.get(patientId);
    await this.tx.patientAccessHistory.create({
      data: {
        id: eventId,
        clinicId: this.clinicId,
        patientId,
        actorId,
        accountId: data.accountId,
        commandId: data.commandId,
        payloadHash: hash,
        action,
        at: new Date(now),
        snapshot: result,
      },
    });
    return {receipt:result,removal:action==='remove' && target.kind==='doctor'?{id:eventId,cutoff:new Date(now).toISOString()}:null};
  }
}
