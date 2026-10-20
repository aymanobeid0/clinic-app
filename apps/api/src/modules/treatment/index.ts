import { VisitRepository } from './visit.repository.js';
import { cancelChargedPlan } from './cancel-charged-plan.js';
import { VisitService } from './visit.service.js';
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
  return treatmentRoutes(
    new TreatmentController(
      new TreatmentService(identity, updates, now),
      new VisitService(identity, updates, now),
      updates,
      now,
    ),
  );
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
