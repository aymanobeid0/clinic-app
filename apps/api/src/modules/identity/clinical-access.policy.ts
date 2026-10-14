import { onboardingStage } from './account-readiness.policy.js';
import type { ManagerAccount } from './identity.repository.js';
export const clinicalPermissions = [
  'clinical.read',
  'clinical.history',
  'chart.draft',
  'history.draft',
  'plans.draft',
  'notes.draft',
  'prescriptions.draft',
  'acceptance.draft',
  'chart.finalize',
  'history.finalize',
  'plans.finalize',
  'notes.finalize',
  'plans.accept',
  'procedures.start',
  'procedures.complete',
  'prescriptions.sign',
  'attachments.upload',
  'attachments.replace',
  'attachments.remove',
  'clinical.print',
  'clinical.download',
] as const;
export type ClinicalPermission = (typeof clinicalPermissions)[number];
const consequential = new Set<string>([
  'chart.finalize',
  'history.finalize',
  'plans.finalize',
  'notes.finalize',
  'plans.accept',
  'procedures.start',
  'procedures.complete',
  'prescriptions.sign',
]);
export function clinicalEligible(account: ManagerAccount, permission?: ClinicalPermission) {
  return (
    !account.disabled &&
    !account.historicalOnly &&
    onboardingStage(account) === 'ready' &&
    (account.kind === 'doctor' ||
      (account.kind === 'staff' && !account.isManager && !consequential.has(permission ?? ''))) &&
    (permission
      ? account.permissions.includes(permission)
      : account.permissions.some(
          (p) =>
            clinicalPermissions.includes(p as ClinicalPermission) &&
            (account.kind === 'doctor' || !consequential.has(p)),
        ))
  );
}
