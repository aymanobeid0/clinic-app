import {
  identitySchema,
  signInSchema,
  replacePasswordSchema,
  requestVerificationSchema,
  verifyEmailSchema,
  regenerateCodesSchema,
  confirmCodesSchema,
  type Identity,
  type RecoveryCodes,
  type SignIn,
  fieldSummary,
  type FieldGuidance,
} from "@clinic/contracts";
import { errorMessages as t } from "../../forms/error.messages.js";

let csrfToken = "";
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: FieldGuidance = {},
    readonly code?: string,
  ) {
    super(fieldSummary(fields, message));
  }
}
export async function readResponse<T>(response: Response): Promise<T> {
  let data: unknown;
  try { data = await response.json(); } catch {
    if (response.ok) throw new Error(t.unreadable);
  }
  if (!response.ok) {
    const envelope = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const fallback = response.status === 401 ? t.unverified
      : response.status === 403 ? t.forbidden
      : response.status === 429 ? t.rateLimited
      : t.uncertain;
    const fields: FieldGuidance = {};
    if (envelope.fields && typeof envelope.fields === "object")
      for (const [key, value] of Object.entries(envelope.fields).slice(0, 20)) {
        if (key.length <= 160 && !key.split('.').some(p => ['__proto__', 'constructor', 'prototype'].includes(p)) && typeof value === 'string') fields[key] = value.slice(0, 256);
      }
    throw new HttpError(response.status, typeof envelope.error === 'string' ? envelope.error : fallback, fields, typeof envelope.code === 'string' ? envelope.code : undefined);
  }
  return data as T;
}
export async function refreshSession(signal?: AbortSignal) {
  const response = await fetch("/api/session", { cache: "no-store", signal });
  if (!response.ok) await readResponse(response);
  csrfToken = (await response.json()).csrfToken;
}

export async function post<T = undefined>(
  path: string,
  body: object,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": body instanceof Blob ? body.type : "application/json", "x-csrf-token": csrfToken },
    body: body instanceof Blob ? body : JSON.stringify(body),
    cache: "no-store",
  });
  const data =
    response.status === 204 || response.status === 202
      ? undefined
      : await readResponse<T & { csrfToken?: string }>(response);
  if (data?.csrfToken) csrfToken = data.csrfToken;
  return data as T;
}

export const identityApi = {
  async getIdentity(signal?: AbortSignal): Promise<Identity | null> {
    await refreshSession(signal);
    const response = await fetch("/api/identity", {
      cache: "no-store",
      signal,
    });
    if (response.status === 401) return null;
    if (!response.ok) await readResponse(response);
    return identitySchema.parse(await response.json());
  },
  async getClinic(
    signal?: AbortSignal,
  ): Promise<{ code: string; name: string }> {
    const response = await fetch("/api/clinic", { cache: "no-store", signal });
    if (!response.ok) await readResponse(response);
    return response.json();
  },
  signIn(input: SignIn) {
    return post("sign-in", signInSchema.parse(input));
  },
  signOut() {
    return post("sign-out", {});
  },
  replacePassword(password: string) {
    return post(
      "onboarding/password",
      replacePasswordSchema.parse({ password }),
    );
  },
  sendVerification(email: string) {
    return post("onboarding/email", requestVerificationSchema.parse({ email }));
  },
  verifyEmail(token: string) {
    return post<RecoveryCodes | null>(
      "onboarding/verify-email",
      verifyEmailSchema.parse({ token }),
    );
  },
  regenerateCodes(password: string) {
    return post<RecoveryCodes>(
      "onboarding/codes",
      regenerateCodesSchema.parse({ password }),
    );
  },
  confirmSavedCodes(batchId: string) {
    return post(
      "onboarding/codes-saved",
      confirmCodesSchema.parse({ batchId, saved: true }),
    );
  },
};
