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
