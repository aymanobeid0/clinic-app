import { z } from 'zod';
export const clinicCodeSchema = z.string().regex(/^[a-z0-9-]{3,32}$/);
export const usernameSchema = z.string().trim().regex(/^[a-zA-Z0-9._-]{3,64}$/).transform((value) => value.toLowerCase());
export const signInSchema = z.object({ clinicCode: clinicCodeSchema, username: usernameSchema, password: z.string().min(1).max(1024) });
export type SignIn = z.infer<typeof signInSchema>;
