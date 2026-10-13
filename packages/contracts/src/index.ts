import { z } from 'zod';
export const clinicCodeSchema = z.string().regex(/^[a-z0-9-]{3,32}$/);
export const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9._-]{3,64}$/)
  .transform((value) => value.toLowerCase());
export const recoveryEmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const signInSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('email'),
    email: recoveryEmailSchema,
    password: z.string().min(1).max(1024),
  }),
  z.object({
    method: z.literal('clinic_username'),
    clinicCode: clinicCodeSchema,
    username: usernameSchema,
    password: z.string().min(1).max(1024),
  }),
]);
export type SignIn = z.infer<typeof signInSchema>;

export const passwordSchema = z.string().min(12).max(128);
export const identitySchema = z.object({
  accountId: z.uuid(),
  clinicId: z.uuid(),
  username: z.string(),
  loginMethod: z.enum(['email', 'clinic_username']),
  isManager: z.boolean(),
  kind: z.enum(['doctor', 'staff']),
  permissions: z.array(z.string()),
  historicalOnly: z.boolean(),
  recoverySetup: z.boolean(),
  loginEmail: recoveryEmailSchema.nullable(),
  displayName: z.string(),
  stage: z.enum(['password', 'email', 'codes', 'ready']),
});
export type Identity = z.infer<typeof identitySchema>;

export const provisionClinicSchema = z.object({
  clinicCode: clinicCodeSchema,
  clinicName: z.string().min(1).max(120),
  username: usernameSchema,
  displayName: z.string().min(1).max(120),
  temporaryPassword: passwordSchema,
  email: recoveryEmailSchema,
});
export const replacePasswordSchema = z.object({ password: passwordSchema });
export const requestVerificationSchema = z.object({
  email: recoveryEmailSchema,
});
export const verifyEmailSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
});
export const regenerateCodesSchema = z.object({
  password: z.string().min(1).max(128),
});
export const confirmCodesSchema = z.object({
  batchId: z.uuid(),
  saved: z.literal(true),
});
export type RecoveryCodes = { codes: string[]; batchId: string };
export const accountKindSchema = z.enum(['doctor', 'staff']);
export const permissionSchema = z.enum([
  'patients.read',
  'patients.create',
  'patients.edit',
  'patients.archive',
  'patients.assign',
  'appointments.manage',
  'appointments.override',
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
  'catalog.manage',
  'billing.read',
  'billing.edit',
  'payments.record',
  'receipts.issue',
  'invoices.issue',
  'financial.history',
  'refunds',
  'reversals',
  'discounts',
  'prices.override',
  'inventory.read',
  'inventory.receive',
  'inventory.consume',
  'inventory.adjust',
  'reports.operational',
  'reports.financial',
  'clinical.print',
  'clinical.download',
  'financial.print',
  'financial.download',
  'exports.patients',
  'exports.financial',
  'exports.inventory',
  'financial.attachments.upload',
  'financial.attachments.replace',
  'financial.attachments.remove',
  'mixed.attachments.upload',
  'mixed.attachments.replace',
  'mixed.attachments.remove',
]);
export const currentPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
});
export const createAccountSchema = currentPasswordSchema.extend({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(120),
  kind: accountKindSchema,
  temporaryPassword: passwordSchema,
  contactEmail: recoveryEmailSchema.nullable().optional(),
  phone: z.string().trim().max(64).nullable().optional(),
});
export const accountMutationSchema = currentPasswordSchema.extend({
  revision: z.int().nonnegative(),
});
export const permissionsSchema = accountMutationSchema.extend({
  permissions: z.array(permissionSchema).max(100),
});
export const renameAccountSchema = accountMutationSchema.extend({
  username: usernameSchema,
});
export const accountKindChangeSchema = accountMutationSchema.extend({
  kind: accountKindSchema,
});
export const managerAuthoritySchema = accountMutationSchema.extend({
  isManager: z.boolean(),
});
export const accountStatusSchema = accountMutationSchema.extend({
  status: z.enum(['active', 'historical', 'disabled']),
});
export const resetAccountSchema = accountMutationSchema.extend({
  temporaryPassword: passwordSchema,
});
export const changePasswordSchema = currentPasswordSchema.extend({
  password: passwordSchema,
});
export type AccountSummary = {
  revision: number;
  id: string;
  username: string;
  displayName: string;
  kind: 'doctor' | 'staff';
  isManager: boolean;
  disabled: boolean;
  historicalOnly: boolean;
  permissions: string[];
  contactEmail: string | null;
  phone: string | null;
};
export const recoveryIdentitySchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('email'), email: recoveryEmailSchema }),
  z.object({
    method: z.literal('clinic_username'),
    clinicCode: clinicCodeSchema,
    username: usernameSchema,
  }),
]);
export const recoverCodeSchema = z.object({
  identity: recoveryIdentitySchema,
  code: z.string().regex(/^[a-f0-9]{32}$/),
  password: passwordSchema,
});
export const recoverRequestSchema = z.object({
  identity: recoveryIdentitySchema,
});
export const recoverEmailSchema = z.object({
  identity: recoveryIdentitySchema,
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: passwordSchema,
});
export const changeEmailSchema = currentPasswordSchema.extend({
  email: recoveryEmailSchema,
});

export const patientDetailsSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    phone: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^\+?[0-9 ()\-\.]+$/)
      .refine((v) => v.replace(/\D/g, '').length >= 3),
    contactKind: z.enum(['patient', 'guardian']),
    contactName: z.string().trim().max(120).default(''),
  })
  .strict()
  .refine((v) => v.contactKind !== 'guardian' || v.contactName.length > 0, {
    message: 'Nom du contact requis.',
    path: ['contactName'],
  });
export const registerPatientSchema = patientDetailsSchema.safeExtend({
  commandId: z.uuid(),
});
export type PatientDetails = z.infer<typeof patientDetailsSchema>;
export type Patient = PatientDetails & {
  id: string;
  patientNumber: number;
  archived: boolean;
  revision: number;
};
export const patientMutationSchema = z
  .object({ commandId: z.uuid(), revision: z.int().nonnegative() })
  .strict();
export const editPatientSchema = patientDetailsSchema.safeExtend({
  commandId: z.uuid(),
  revision: z.int().nonnegative(),
});
export type PatientHistory = {
  action: string;
  at: string;
  actorId: string;
  patient: Patient;
};
