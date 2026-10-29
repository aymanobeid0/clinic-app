import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { recoverAccount, type RecoveryCommand } from "./recovery.api.js";
import { createIdentityWorkflow } from "./identity.workflow.js";
import { useIdentityCommand } from "./useIdentityCommand.js";

export function useRecovery() {
  const [route, setRoute] = useState(() =>
    new URLSearchParams(location.hash.slice(1)).has("recovery")
      ? "email"
      : "code",
  );
  const form = useForm<{
    method: "email" | "clinic_username";
    email: string;
    clinicCode: string;
    username: string;
    code: string;
    token: string;
    password: string;
  }>({
    defaultValues: {
      method: "email",
      token: new URLSearchParams(location.hash.slice(1)).get("recovery") ?? "",
    },
  });
  useEffect(() => {
    const capture = () => {
      const value = new URLSearchParams(location.hash.slice(1)).get("recovery");
      if (value) {
        form.setValue("token", value);
        setRoute("email");
        history.replaceState(null, "", location.pathname + location.search);
      }
    };
    capture();
    window.addEventListener("hashchange", capture);
    return () => window.removeEventListener("hashchange", capture);
  }, [form]);
  const { error, notice, busy, setNotice, run } = useIdentityCommand();
  const cache = useQueryClient();
  const workflow = useMemo(() => createIdentityWorkflow(cache), [cache]);
  const method = form.watch("method");
  const submit = form.handleSubmit(async (d) => {
    const identity =
      d.method === "email"
        ? { method: d.method, email: d.email }
        : {
            method: d.method,
            clinicCode: d.clinicCode,
            username: d.username,
          };
    const command: RecoveryCommand =
      route === "code"
        ? {
            route: "code",
            input: { identity, code: d.code, password: d.password },
          }
        : route === "email"
          ? {
              route: "email",
              input: { identity, token: d.token, password: d.password },
            }
          : { route: "request", input: { identity } };
    await run(async () => {
      if (command.route === "request") await recoverAccount(command);
      else await workflow.transition(() => recoverAccount(command));
      form.reset();
      if (route === "request")
        setNotice(
          "Si le compte est éligible, un lien de récupération a été envoyé.",
        );
      else {
        history.replaceState(null, "", location.pathname + location.search);
      }
    });
  });
  return { form, method, route, setRoute, error, notice, busy, submit };
}
