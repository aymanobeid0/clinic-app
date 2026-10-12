import { z } from 'zod';
export const clinicCodeSchema = z.string().regex(/^[a-z0-9-]{3,32}$/);
export const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9._-]{3,64}$/)
  .transform((value) => value.toLowerCase());
export const signInSchema = z.object({
  clinicCode: clinicCodeSchema,
  username: usernameSchema,
  password: z.string().min(1).max(1024),
});
export type SignIn = z.infer<typeof signInSchema>;

export const passwordSchema = z.string().min(12).max(128);
export const recoveryEmailSchema = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());
export const identitySchema = z.object({
  accountId: z.uuid(),
  clinicId: z.uuid(),
  username: z.string(),
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
});
export const replacePasswordSchema = z.object({ password: passwordSchema });
export const requestVerificationSchema = z.object({ email: recoveryEmailSchema });
export const verifyEmailSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });
export const regenerateCodesSchema = z.object({ password: z.string().min(1).max(128) });
export const confirmCodesSchema = z.object({ batchId: z.uuid(), saved: z.literal(true) });
export type RecoveryCodes = { codes: string[]; batchId: string };
