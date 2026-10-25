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
} from "@clinic/contracts";

let csrfToken = "";
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function refreshSession(signal?: AbortSignal) {
  const response = await fetch("/api/session", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Service indisponible. Réessayez.");
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
      : await response.json();
  if (!response.ok)
    throw new HttpError(
      response.status,
      data?.error ?? "Service indisponible. Réessayez.",
    );
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
    if (!response.ok) throw new Error("Service indisponible. Réessayez.");
    return identitySchema.parse(await response.json());
  },
  async getClinic(
    signal?: AbortSignal,
  ): Promise<{ code: string; name: string }> {
    const response = await fetch("/api/clinic", { cache: "no-store", signal });
    if (!response.ok)
      throw new HttpError(
        response.status,
        "Accès indisponible. Reconnectez-vous.",
      );
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
