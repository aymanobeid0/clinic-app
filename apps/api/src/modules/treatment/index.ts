import { VisitRepository } from './visit.repository.js';
import { cancelChargedPlan } from './cancel-charged-plan.js';
import { VisitService } from './visit.service.js';
import {ConsultationService} from './consultation.service.js';
import {ConsultationRepository} from './consultation.repository.js';
import {consultationRoutes} from './consultation.routes.js';
import {Router} from 'express';
import { TreatmentRepository } from './treatment.repository.js';
import type { IdentityAccess } from '../identity/index.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { TreatmentController } from './treatment.controller.js';
import { TreatmentService } from './treatment.service.js';
import { treatmentRoutes } from './treatment.routes.js';
export function createTreatmentRoutes(
  identity: IdentityAccess,
  updates: ClinicUpdates,
  now: () => number,
) {
  return Router().use(consultationRoutes(new ConsultationService(identity,updates,now))).use(treatmentRoutes(
    new TreatmentController(
      new TreatmentService(identity, updates, now),
      new VisitService(identity, updates, now),
      updates,
      now,
    ),
  ));
}
// Public scheduling projection deliberately excludes prices and patient content.
export async function procedureDurations(
  tx: import('../../database.js').ClinicTransaction,
  clinicId: string,
) {
  return new TreatmentRepository(tx, clinicId).durations();
}

export { recordProcedureStart } from './procedure-start.js';
export { exactMinor } from './treatment.service.js';

// Billing coordinates financial writes with the retained treatment agreement.
export function treatmentBilling(tx: import('../../database.js').ClinicTransaction, clinicId: string) {
  const repository = new TreatmentRepository(tx, clinicId);
  return {
    lock: () => repository.lock(),
    completions: (patientId: string) => new VisitRepository(tx, clinicId).completions(patientId),
    versions: (patientId: string, planId?: string) => repository.versions(patientId, planId),
    currency: (code: string) => repository.enabled(code),
    cancel: async (patientId: string, planId: string, revision: number, actorId: string, reason: string, at: string) => {
      await cancelChargedPlan(tx,clinicId,patientId,planId,revision,actorId,reason,at);
    },
  };
}

// Clinical notes use this patient-scoped encounter projection, without pricing.
export async function noteVisit(
  tx: import('../../database.js').ClinicTransaction,
  clinicId: string,
  patientId: string,
  visitId: string,
) {
  const row = await new VisitRepository(tx, clinicId).existing(visitId);
  if (!row || row.patientId !== patientId) return null;
  const v = row.snapshot as unknown as import('@clinic/contracts').Visit;
  return { id: row.id, status: v.status };
}

export async function noteVisits(
  tx: import('../../database.js').ClinicTransaction,
  clinicId: string,
  patientId: string,
) {
  return new VisitRepository(tx, clinicId).noteVisits(patientId);
}

// Clinical chart consumes only completed, explicitly categorized work; no price data.
export async function completedChartWork(
  tx: import("../../database.js").ClinicTransaction,
  clinicId: string,
  patientId: string,
) {
  const state = await new VisitRepository(tx, clinicId).state(patientId);
  return state.completions.flatMap((completion) => {
    const start = state.starts.find(
      (s) => s.planId === completion.planId && s.itemId === completion.itemId,
    );
    const category = start?.item.chartCategory;
    if (!start || !category || category === "manual") return [];
    return [
      {
        id: completion.id,
        name: start.item.name,
        category,
        teeth: start.item.teeth,
        scope: start.item.scope,
      },
    ];
  });
}
export async function captureTreatment(tx:import('../../database.js').ClinicTransaction,clinicId:string,patientId:string,attachments:import('@clinic/contracts').AttachmentVersion[]) {
 const plans=await new TreatmentRepository(tx,clinicId).versions(patientId);
 const state=await new VisitRepository(tx,clinicId).state(patientId);
 return {
  consultations:(await new ConsultationRepository(tx,clinicId).current(patientId)).map(({priceMinor:_,currency:__,remuneration:___,...v})=>v),
  plans:plans.map(p=>({id:p.id,patientId:p.patientId,revision:p.revision,title:p.title,status:p.status,notes:p.notes,cancellation:p.cancellation,recordedAt:p.recordedAt,authorId:p.authorId,authorName:p.authorName,
    evidence:p.evidence?safeEvidence(p.evidence,attachments):undefined,
    acceptance:p.acceptance?safeEvidence(p.acceptance,attachments):undefined,
    items:p.items.map(i=>({id:i.id,procedureId:i.procedureId,catalogRevision:i.catalogRevision,name:i.name,durationMinutes:i.durationMinutes,scope:i.scope,teeth:i.teeth,chartCategory:i.chartCategory}))})),
  starts:state.starts.map(s=>({id:s.id,patientId:s.patientId,planId:s.planId,itemId:s.itemId,visitId:s.visitId,acceptedRevision:s.acceptedRevision,performedBy:s.performedBy,performedByName:s.performedByName,at:s.at})),
  visits:state.visits,completions:state.completions,
 };
}
function safeEvidence<T extends import('@clinic/contracts').PlanEvidence>(evidence:T,attachments:import('@clinic/contracts').AttachmentVersion[]):T {
  const {attachment,...rest}=evidence;
  return {...rest,...(attachment && attachments.some(v=>v.id===attachment.id && v.revision===attachment.revision)?{attachment}:{})} as T;
}

// Shared monetary reference; callers keep their own authorization and workflow.
export function enabledClinicCurrency(tx: import('../../database.js').ClinicTransaction, clinicId: string, code: string) {
  return new TreatmentRepository(tx,clinicId).enabled(code);
}

export function enabledClinicCurrencies(tx: import('../../database.js').ClinicTransaction, clinicId: string) {
  return new TreatmentRepository(tx,clinicId).currencies();
}
export {assertExportBound as boundTreatmentExport} from './export-bounds.repository.js';
