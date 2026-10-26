import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createAccountSchema,
  permissionSchema,
  type AccountSummary,
} from "@clinic/contracts";
import type { z } from "zod";
import { accountsApi, type AccountChange } from "./accounts.api.js";

type Run = (action: () => Promise<unknown>) => Promise<boolean>;
type CreateInput = z.input<typeof createAccountSchema>;

export function useAccountEditor(a: AccountSummary, run: Run) {
  const form = useForm<{
    currentPassword: string;
    username: string;
    temporaryPassword: string;
    kind: "doctor" | "staff";
    status: "active" | "historical" | "disabled";
    isManager: boolean;
    permissions: z.input<typeof permissionSchema>[];
  }>({
    defaultValues: {
      username: a.username,
      kind: a.kind,
      status: a.disabled
        ? "disabled"
        : a.historicalOnly
          ? "historical"
          : "active",
      isManager: a.isManager,
      permissions: a.permissions.filter(
        (value): value is z.input<typeof permissionSchema> =>
          permissionSchema.safeParse(value).success,
      ),
    },
  });
  const loadedRevision = useRef(a.revision);
  const dirty = form.formState.isDirty;
  useEffect(() => {
    if (dirty) return;
    loadedRevision.current = a.revision;
    form.reset({
      username: a.username,
      kind: a.kind,
      status: a.disabled
        ? "disabled"
        : a.historicalOnly
          ? "historical"
          : "active",
      isManager: a.isManager,
      permissions: a.permissions.filter(
        (value): value is z.input<typeof permissionSchema> =>
          permissionSchema.safeParse(value).success,
      ),
      currentPassword: "",
      temporaryPassword: "",
    });
  }, [a, form, dirty]);
  const [operation, setOperation] = useState("permissions");
  const submit = form.handleSubmit(async (d) => {
    const common = {
      revision: loadedRevision.current,
      currentPassword: d.currentPassword,
    };
    let command: AccountChange;
    switch (operation) {
      case "permissions":
        command = {
          operation,
          input: { ...common, permissions: d.permissions },
        };
        break;
      case "username":
        command = { operation, input: { ...common, username: d.username } };
        break;
      case "reset-password":
        command = {
          operation,
          input: { ...common, temporaryPassword: d.temporaryPassword },
        };
        break;
      case "kind":
        command = { operation, input: { ...common, kind: d.kind } };
        break;
      case "manager":
        command = { operation, input: { ...common, isManager: d.isManager } };
        break;
      default:
        command = {
          operation: "status",
          input: { ...common, status: d.status },
        };
    }
    const saved = await run(() => accountsApi.change(a.id, command));
    if (saved) form.reset({ ...d, currentPassword: "", temporaryPassword: "" });
    form.resetField("currentPassword");
    form.resetField("temporaryPassword");
  });
  return { form, operation, setOperation, submit };
}

export function useCreateAccount(
  run: Run,
  setError: (message: string) => void,
) {
  const form = useForm<
    CreateInput,
    unknown,
    z.infer<typeof createAccountSchema>
  >({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { kind: "staff" },
  });
  const submit = form.handleSubmit(
    async (data) => {
      if (await run(() => accountsApi.create(data)))
        form.reset({ kind: "staff" });
    },
    () => setError(""),
  );
  return { form, submit };
}

export function useSelfSettings(run: Run) {
  const password = useForm<{ currentPassword: string; password: string }>();
  const email = useForm<{ currentPassword: string; email: string }>();
  const submitPassword = password.handleSubmit(async (d) => {
    await run(() => accountsApi.changePassword(d));
    password.reset();
  });
  const submitEmail = email.handleSubmit(async (d) => {
    if (await run(() => accountsApi.changeEmail(d))) email.reset();
  });
  return { password, email, submitPassword, submitEmail };
}
