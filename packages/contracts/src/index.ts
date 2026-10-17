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

export const sharePatientSchema = z
  .object({
    commandId: z.uuid(),
    revision: z.int().nonnegative(),
    accountId: z.uuid(),
    kind: z.enum(['assigned', 'shared']),
  })
  .strict();
export const removePatientAccessSchema = sharePatientSchema.omit({
  kind: true,
});
export type PatientAccess = {
  patientId: string;
  revision: number;
  grants: {
    accountId: string;
    displayName: string;
    kind: 'assigned' | 'shared';
  }[];
};
export type AssignmentCandidate = {
  id: string;
  displayName: string;
  kind: 'doctor' | 'staff';
};
export type PatientAccessEvent = {
  actorId: string;
  accountId: string;
  actorDisplayName: string;
  accountDisplayName: string;
  action: string;
  at: string;
  snapshot: PatientAccess;
};

export const appointmentStatusSchema = z.enum([
  "booked",
  "confirmed",
  "arrived",
  "in_care",
  "completed",
  "cancelled",
  "no_show",
]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;
const slotFields = {
  dentistId: z.uuid(),
  chairId: z.string().trim().min(1).max(80).nullable(),
  startsAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(5).max(480),
  override: z.boolean().default(false),
};
export const bookAppointmentSchema = z
  .object({
    commandId: z.uuid(),
    patientId: z.uuid(),
    ...slotFields,
    durationMinutes: z.number().int().min(5).max(480).optional(),
    walkIn: z.boolean().default(false),
  })
  .strict();
export const rescheduleAppointmentSchema = z
  .object({
    commandId: z.uuid(),
    revision: z.number().int().min(0),
    ...slotFields,
  })
  .strict();
export const changeAppointmentStatusSchema = z
  .object({
    commandId: z.uuid(),
    revision: z.number().int().min(0),
    status: appointmentStatusSchema,
    reason: z.string().trim().max(500).default(""),
    override: z.boolean().default(false),
  })
  .strict();
export const schedulingSettingsSchema = z
  .object({
    commandId: z.uuid(),
    revision: z.number().int().min(0),
    defaultDurationMinutes: z.number().int().min(5).max(480),
    chairs: z
      .array(z.string().trim().min(1).max(80))
      .max(100)
      .refine(
        (v) => new Set(v).size === v.length,
        "Les noms des fauteuils doivent être distincts.",
      ),
  })
  .strict();
export type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  patientNumber: number;
  dentistId: string;
  dentistName: string;
  chairId: string | null;
  startsAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  walkIn: boolean;
  revision: number;
  cancellationReason: string;
};
export type SchedulingSettings = {
  revision: number;
  defaultDurationMinutes: number;
  chairs: string[];
};
export type AppointmentHistory = {
  actorId: string;
  actorName: string;
  at: string;
  action: string;
  override: boolean;
  appointment: Appointment;
};
export type SchedulingChoices = {
  patients: { id: string; name: string; patientNumber: number }[];
  dentists: { id: string; displayName: string }[];
};
// A future catalog consumer may supply a suggestion; it never silently changes a saved reservation.
export type ProcedureDurationSuggestion = {
  procedureId: string;
  durationMinutes: number;
  label: string;
};

export const medicalHistoryContentSchema = z
  .object({
    medicalHistory: z.string().trim().max(8000),
    allergies: z.string().trim().max(4000),
  })
  .strict();
export const clinicalDraftSchema = z
  .object({
    commandId: z.uuid(),
    revision: z.number().int().nonnegative(),
    observedAt: z.iso.datetime(),
    content: medicalHistoryContentSchema,
  })
  .strict();
export const clinicalConfirmSchema = z
  .object({ commandId: z.uuid(), revision: z.number().int().positive() })
  .strict();
export type ClinicalVersion<T = MedicalHistoryContent> = {
  revision: number;
  observedAt: string;
  recordedAt: string;
  authorId: string;
  authorName: string;
  finalizerId: string | null;
  finalizerName: string | null;
  status: 'draft' | 'final';
  content: T;
};
export type MedicalHistoryContent = z.infer<typeof medicalHistoryContentSchema>;
export type ClinicalRecord<T = MedicalHistoryContent> = {
  revision: number;
  current: ClinicalVersion<T> | null;
  draft: ClinicalVersion<T> | null;
  events: ClinicalVersion<T>[];
};

export const chartContentSchema = z
  .object({
    numberingScheme: z.literal('FDI'),
    otherNotes: z.string().trim().max(4000).optional(),
    dentition: z.enum(['permanent', 'primary', 'mixed']),
    teeth: z
      .array(
        z
          .object({
            tooth: z.string().regex(/^[1-4][1-8]$|^[5-8][1-5]$/),
            presence: z.enum(['unknown', 'present', 'missing', 'unerupted']),
            extractionHistory: z.boolean(),
            conditions: z
              .array(
                z
                  .object({
                    finding: z.enum([
                      'sound',
                      'decay',
                      'restoration',
                      'fracture',
                      'other',
                    ]),
                    surfaces: z
                      .array(
                        z.enum([
                          'mesial',
                          'distal',
                          'outer',
                          'inner',
                          'incisal',
                          'occlusal',
                        ]),
                      )
                      .max(5),
                    note: z.string().trim().max(1000).optional(),
                  })
                  .strict(),
              )
              .max(30),
            treatments: z
              .array(z.enum(['crown', 'root_canal', 'implant']))
              .max(3),
          })
          .strict(),
      )
      .max(52),
  })
  .strict()
  .superRefine((chart, ctx) => {
    const teeth = new Set<string>();
    chart.teeth.forEach((tooth, i) => {
      const add = (message: string) =>
        ctx.addIssue({ code: 'custom', message, path: ['teeth', i] });
      if (teeth.has(tooth.tooth)) add('Position FDI en double.');
      teeth.add(tooth.tooth);
      const primary = Number(tooth.tooth[0]) >= 5;
      if (
        (chart.dentition === 'primary' && !primary) ||
        (chart.dentition === 'permanent' && primary)
      )
        add('Dentition incompatible.');
      if (new Set(tooth.treatments).size !== tooth.treatments.length)
        add('Traitement en double.');
      tooth.conditions.forEach((c) => {
        if (c.finding === 'other' && !c.note?.trim())
          add('Une note est requise pour Autre.');
        if (c.finding === 'sound' && c.surfaces.length)
          add('Sain concerne la dent entière.');
        if (new Set(c.surfaces).size !== c.surfaces.length)
          add('Surface en double.');
        if (
          c.surfaces.includes(
            Number(tooth.tooth[1]) <= 3 ? 'occlusal' : 'incisal',
          )
        )
          add('Surface incompatible avec la dent.');
      });
    });
  });
export const chartDraftSchema = clinicalDraftSchema.extend({
  content: chartContentSchema,
});
export type ChartContent = z.infer<typeof chartContentSchema>;
export type ClinicalContent = MedicalHistoryContent | ChartContent;
export type ClinicalWorkspace = {
  history: ClinicalRecord<ClinicalContent>;
  chart: ClinicalRecord<ClinicalContent>;
};

// Verified ISO 4217 subset: SIX list-one.xml, published 2026-09-17, checked 2026-10-16.
export const verifiedCurrencies = {
  MRU: 2,
  EUR: 2,
  USD: 2,
  JPY: 0,
  KWD: 3,
} as const;
export const currencyCodeSchema = z.enum(['MRU', 'EUR', 'USD', 'JPY', 'KWD']);
export const enableCurrencySchema = z
  .object({ commandId: z.uuid(), code: currencyCodeSchema })
  .strict();
export const exactAmountSchema = z
  .string()
  .regex(
    /^(0|[1-9][0-9]{0,14})(\.[0-9]{1,3})?$/,
    'Montant exact positif, sans arrondi.',
  );
export const catalogCommandSchema = z
  .object({
    commandId: z.uuid(),
    id: z.uuid(),
    revision: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(160),
    currency: currencyCodeSchema,
    price: exactAmountSchema,
    durationMinutes: z.number().int().min(5).max(480),
    active: z.boolean(),
  })
  .strict();
export type CatalogEntry = {
  id: string;
  revision: number;
  name: string;
  currency: keyof typeof verifiedCurrencies;
  priceMinor: string;
  durationMinutes: number;
  active: boolean;
};
export type Catalog = {
  entries: CatalogEntry[];
  currencies: (keyof typeof verifiedCurrencies)[];
};

export const treatmentItemSchema = z
  .object({
    id: z.uuid(),
    procedureId: z.uuid(),
    catalogRevision: z.number().int().positive(),
    scope: z.enum(['tooth', 'teeth', 'whole_mouth']),
    teeth: z.array(z.string().regex(/^[1-4][1-8]$|^[5-8][1-5]$/)).max(52),
    price: exactAmountSchema,
    discount: exactAmountSchema,
    discountReason: z.string().trim().max(1000),
    extras: z
      .array(
        z
          .object({
            id: z.uuid(),
            label: z.string().trim().min(1).max(200),
            amount: exactAmountSchema,
          })
          .strict(),
      )
      .max(50)
      .default([]),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      new Set(v.teeth).size !== v.teeth.length ||
      (v.scope === 'whole_mouth'
        ? v.teeth.length !== 0
        : v.scope === 'tooth'
          ? v.teeth.length !== 1
          : v.teeth.length < 2)
    )
      c.addIssue({
        code: 'custom',
        message: 'Sélection FDI incompatible avec la portée.',
      });
  });
export const treatmentPlanSchema = z
  .object({
    commandId: z.uuid(),
    id: z.uuid(),
    revision: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(160),
    notes: z.string().trim().max(10000).default(''),
    currency: currencyCodeSchema,
    items: z.array(treatmentItemSchema).min(1).max(100),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.items.map((i) => i.id)).size !== v.items.length)
      c.addIssue({ code: 'custom', message: 'Acte en double.' });
  });
export type TreatmentItem = {
  id: string;
  procedureId: string;
  catalogRevision: number;
  name: string;
  durationMinutes: number;
  scope: 'tooth' | 'teeth' | 'whole_mouth';
  teeth: string[];
  baseMinor: string;
  priceMinor: string;
  discountMinor: string;
  discountReason: string;
  extras?: { id: string; label: string; amountMinor: string }[];
};
export type PlanEvidence = {
  acceptedBy: string;
  acceptedAt: string;
  method: string;
  proposalRevision: number;
  recordedBy: string;
  recordedByName: string;
  recordedAt: string;
  // Attachment support (#19) will add an authorized immutable file-version reference.
};
export type PlanAcceptance = PlanEvidence & {
  confirmedBy: string;
  confirmedByName: string;
  confirmedAt: string;
};
export type TreatmentVersion = {
  id: string;
  patientId: string;
  revision: number;
  title: string;
  currency: keyof typeof verifiedCurrencies;
  status:
    | 'draft'
    | 'presented'
    | 'accepted'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
  cancellation?: {
    reason: string;
    actorId: string;
    actorName: string;
    at: string;
  };
  notes?: string;
  evidence?: PlanEvidence;
  acceptance?: PlanAcceptance;
  items: TreatmentItem[];
  totalMinor: string;
  authorId: string;
  authorName: string;
  recordedAt: string;
};
export type TreatmentPlan = TreatmentVersion & { events: TreatmentVersion[] };

export const planLifecycleSchema = z
  .object({
    commandId: z.uuid(),
    id: z.uuid(),
    revision: z.number().int().positive(),
    action: z.enum(['present', 'evidence', 'accept', 'cancel']),
    reason: z.string().trim().min(1).max(1000).optional(),
    acceptedBy: z.string().trim().min(1).max(200).optional(),
    acceptedAt: z.iso.datetime().optional(),
    method: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

// Visit commands carry reviewed plan revisions; a visit never completes an item implicitly.
export const visitSelectionSchema = z
  .object({
    planId: z.uuid(),
    itemId: z.uuid(),
    planRevision: z.number().int().positive(),
  })
  .strict();
export const startVisitSchema = z
  .object({
    commandId: z.uuid(),
    id: z.uuid(),
    appointmentId: z.uuid().nullable(),
    procedures: z.array(visitSelectionSchema).min(1).max(100),
  })
  .strict();
export type VisitSelection = z.infer<typeof visitSelectionSchema>;
export type Visit = {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  appointmentId: string | null;
  revision: number;
  status: 'draft' | 'ended';
  startedAt: string;
  endedAt?: string;
  procedures: { planId: string; itemId: string; name: string }[];
};
export type ProcedureStart = {
  id: string;
  patientId: string;
  planId: string;
  itemId: string;
  visitId: string;
  acceptedRevision: number;
  acceptance: PlanAcceptance;
  item: TreatmentItem;
  currency: keyof typeof verifiedCurrencies;
  agreedMinor: string;
  performedBy: string;
  performedByName: string;
  at: string;
};
export type ProcedureCompletion = {
  id: string;
  patientId: string;
  planId: string;
  itemId: string;
  visitId: string;
  completedBy: string;
  completedByName: string;
  at: string;
};
export type VisitState = {
  visits: Visit[];
  starts: ProcedureStart[];
  completions: ProcedureCompletion[];
  appointments: { id: string; startsAt: string; walkIn: boolean }[];
};
export const visitActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      commandId: z.uuid(),
      id: z.uuid(),
      revision: z.number().int().positive(),
      action: z.literal('end'),
    })
    .strict(),
  z
    .object({
      commandId: z.uuid(),
      id: z.uuid(),
      revision: z.number().int().positive(),
      action: z.literal('complete'),
      planId: z.uuid(),
      itemId: z.uuid(),
    })
    .strict(),
]);

export type VisitNoteContent = { text: string };
export type VisitNote = ClinicalRecord<VisitNoteContent> & {
  visitId: string;
  pending: boolean;
};
export const noteDraftSchema = z
  .object({
    commandId: z.uuid(),
    revision: z.number().int().nonnegative(),
    text: z.string().max(30000),
  })
  .strict();
