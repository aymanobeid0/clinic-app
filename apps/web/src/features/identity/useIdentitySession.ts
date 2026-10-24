import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Identity, RecoveryCodes, SignIn } from "@clinic/contracts";
import { identityApi } from "./identity.api.js";
import { createIdentityWorkflow, identityScope } from "./identity.workflow.js";
import { useIdentityCommand } from "./useIdentityCommand.js";

// Server records belong to TanStack Query; form values live in each form.
// One-time codes and notices remain only in this mounted page's memory.
export function useIdentitySession() {
  const cache = useQueryClient();
  const workflow = useMemo(() => createIdentityWorkflow(cache), [cache]);
  const identity = useQuery(workflow.query);
  const { error, notice, busy, setError, setNotice, run } =
    useIdentityCommand();
  const [codes, setCodes] = useState<
    (RecoveryCodes & { owner: string }) | null
  >(null);
  const accountKey =
    identity.data && !identity.error
      ? `${identity.data.clinicId}:${identity.data.accountId}`
      : undefined;
  const clinic = useQuery({
    queryKey: ["clinic", accountKey],
    queryFn: ({ signal }) => identityApi.getClinic(signal),
    enabled:
      identity.data?.stage === "ready" &&
      !identity.data.historicalOnly &&
      !!accountKey,
    gcTime: 0,
  });
  const visibleCodes =
    codes &&
    codes.owner === accountKey &&
    identity.data?.isManager &&
    !identity.data.historicalOnly
      ? codes
      : null;
  useEffect(() => {
    setCodes(null);
  }, [accountKey]);
  const [verificationToken, setVerificationToken] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("verification") ?? "",
  );
  const previousAccount = useRef(accountKey);
  useEffect(() => {
    if (previousAccount.current && previousAccount.current !== accountKey) {
      setVerificationToken("");
      setNotice("");
      setError("");
    }
    previousAccount.current = accountKey;
  }, [accountKey, setNotice, setError]);

  useEffect(() => {
    function captureVerificationLink() {
      const token = new URLSearchParams(location.hash.slice(1)).get(
        "verification",
      );
      if (!token) return;
      setVerificationToken(token);
      history.replaceState(null, "", location.pathname + location.search);
    }
    captureVerificationLink();
    window.addEventListener("hashchange", captureVerificationLink);
    return () =>
      window.removeEventListener("hashchange", captureVerificationLink);
  }, []);

  const reloadIdentity = () =>
    cache.invalidateQueries({ queryKey: ["identity"] });
  function stillCurrent() {
    const current = cache.getQueryData<Identity | null>(["identity"]);
    return (
      !!current && `${current.clinicId}:${current.accountId}` === accountKey
    );
  }

  return {
    identity: identity.error ? undefined : identity.data,
    scopeKey: identity.error ? "" : identityScope(identity.data),
    clinic: identity.error ? undefined : clinic.data,
    loading: identity.isPending,
    unavailable: !!identity.error,
    error: error || identity.error?.message || clinic.error?.message,
    notice,
    busy,
    codes: visibleCodes,
    verificationToken,
    setValidationError: setError,
    signIn(input: SignIn) {
      return run(async () => {
        setCodes(null);
        setVerificationToken("");
        await workflow.signIn(input);
      }).then(() => {});
    },
    replacePassword(password: string) {
      return run(async () => {
        await workflow.transition(() => identityApi.replacePassword(password));
        setNotice(
          "Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.",
        );
      }).then(() => {});
    },
    sendVerification(email: string) {
      return run(async () => {
        await identityApi.sendVerification(email);
        setNotice(
          "Message envoyé. Ouvrez le lien reçu ou saisissez son code de vérification.",
        );
      }).then(() => {});
    },
    verifyEmail(token: string) {
      return run(async () => {
        const result = await identityApi.verifyEmail(token);
        if (accountKey && result && stillCurrent())
          setCodes({ ...result, owner: accountKey });
        setVerificationToken("");
        await reloadIdentity();
      }).then(() => {});
    },
    regenerateCodes(password: string) {
      return run(async () => {
        const result = await identityApi.regenerateCodes(password);
        if (accountKey && stillCurrent())
          setCodes({ ...result, owner: accountKey });
        await reloadIdentity();
      }).then(() => {});
    },
    confirmSavedCodes() {
      return run(async () => {
        if (!visibleCodes) return;
        await identityApi.confirmSavedCodes(visibleCodes.batchId);
        setCodes(null);
        await reloadIdentity();
      }).then(() => {});
    },
    signOut() {
      return run(async () => {
        setCodes(null);
        setVerificationToken("");
        await workflow.transition(() => identityApi.signOut());
      }).then(() => {});
    },
  };
}
