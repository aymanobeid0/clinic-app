import { reportingMessages as t } from "./reporting.messages.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type DefaultValues } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  createExportSchema,
  type ExportRequest,
  type ExportReceipt,
  type Identity,
} from "@clinic/contracts";
import { HttpError, post } from "../identity/identity.api.js";
import { identityScope } from "../identity/identity.workflow.js";
import { useTreatmentCommand } from "../treatment/useTreatmentCommand.js";
import {
  treatmentRead,
  treatmentDenied,
} from "../treatment/treatment.workflow.js";
import { operationalAllowed } from "./reporting.access.js";
type WithoutCommand<T> = T extends unknown ? Omit<T, "commandId"> : never;
export type ExportFields = WithoutCommand<ExportRequest>;
// Only coarse capability hints here; current patient/content/own-work rules remain server-owned.
function allowed(identity: Identity, value: ExportFields) {
  if (!operationalAllowed(identity)) return false;
  const has = (permission: Identity["permissions"][number]) =>
    identity.permissions.includes(permission);
  if (value.category === "financial")
    return (
      identity.isManager || (has("exports.financial") && has("billing.read"))
    );
  if (value.category === "inventory")
    return has("exports.inventory") && has("inventory.read");
  if (value.category === "patients")
    return has("exports.patients") && has("patients.read");
  const clinical =
    value.category === "clinical" ||
    (value.category === "attachments" && value.classification !== "financial");
  const financial =
    value.category === "attachments" && value.classification !== "clinical";
  return (
    (!clinical ||
      ((identity.kind === "doctor" || !identity.isManager) &&
        has("exports.patients") &&
        has("clinical.read") &&
        has("clinical.history") &&
        has("clinical.download"))) &&
    (!financial ||
      identity.isManager ||
      (identity.kind !== "doctor" &&
        has("exports.financial") &&
        has("billing.read") &&
        has("financial.download") &&
        has("financial.history") &&
        has("clinical.read")))
  );
}
export function useExport(
  identity: Identity,
  defaults: DefaultValues<ExportFields>,
) {
  const cache = useQueryClient();
  const account = identityScope(identity);
  const scope = JSON.stringify([account, defaults]);
  const owner = useMemo(() => ({ scope }), [scope]);
  const current = useRef(owner);
  current.current = owner;
  const mounted = useRef(false);
  const downloadRequest = useRef<AbortController | null>(null);
  const initial = useRef(defaults);
  initial.current = defaults;
  const form = useForm<ExportFields>({ defaultValues: defaults });
  const [local, setLocal] = useState<{
    owner: typeof owner;
    receipt?: ExportReceipt;
    error: string;
    busy: boolean;
    expired: boolean;
    denied?: boolean;
  }>({ owner, error: "", busy: false, expired: false });
  const state =
    local.owner === owner
      ? local
      : {
          owner,
          error: "",
          busy: false,
          expired: false,
          receipt: undefined,
          denied: false,
        };
  const active = () => mounted.current && current.current === owner;
  const command = useTreatmentCommand<ExportReceipt>(
    ["exports", account, scope],
    (receipt) => {
      setLocal({ owner, receipt, error: "", busy: false, expired: false });
    },
    undefined,
    t.exportReady,
  );
  useEffect(() => {
    mounted.current = true;
    form.reset(initial.current);
    return () => {
      mounted.current = false;
      downloadRequest.current?.abort();
      downloadRequest.current = null;
    };
  }, [scope, form]);
  useEffect(() => {
    if (command.denied || state.denied || !operationalAllowed(identity)) {
      form.reset(initial.current);
      downloadRequest.current?.abort();
      if (!state.denied)
        setLocal({ owner, error: "", busy: false, expired: false });
    }
  }, [
    command.denied,
    state.denied,
    account,
    scope,
    form,
    identity.stage,
    identity.historicalOnly,
  ]);
  const expiresAt = state.receipt?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(
      () => {
        downloadRequest.current?.abort();
        setLocal({
          owner,
          error: t.exportExpired,
          busy: false,
          expired: true,
        });
      },
      Math.max(0, Date.parse(expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [expiresAt, scope]);
  async function submit(confirmed: boolean) {
    if (
      !confirmed ||
      command.busy ||
      command.uncertain ||
      state.busy ||
      command.denied ||
      state.denied
    )
      return;
    const parsed = createExportSchema.safeParse({
      ...form.getValues(),
      commandId: crypto.randomUUID(),
    });
    if (!parsed.success) {
      setLocal({
        owner,
        error: t.exportInvalid,
        busy: false,
        expired: false,
      });
      return;
    }
    if (!allowed(identity, parsed.data)) {
      setLocal({
        owner,
        error: t.exportDenied,
        busy: false,
        expired: false,
      });
      return;
    }
    setLocal({ owner, error: "", busy: false, expired: false });
    const { commandId: _commandId, ...payload } = parsed.data;
    void _commandId;
    return command.save("exports", payload);
  }
  async function download() {
    const receipt = state.receipt;
    if (
      !receipt ||
      !operationalAllowed(identity) ||
      command.denied ||
      state.denied ||
      state.busy ||
      downloadRequest.current
    )
      return;
    if (Date.parse(receipt.expiresAt) <= Date.now()) {
      setLocal({
        owner,
        error: t.exportExpired,
        busy: false,
        expired: true,
      });
      return;
    }
    const controller = new AbortController();
    downloadRequest.current = controller;
    setLocal({ ...state, busy: true, error: "" });
    try {
      const blob = await treatmentRead(
        cache,
        ["exports", account],
        async () => {
          const response = await fetch(
            `/api/exports/${encodeURIComponent(receipt.id)}/content`,
            { cache: "no-store", signal: controller.signal },
          );
          if (!response.ok) {
            const data = await response.json();
            throw new HttpError(
              response.status,
              data.error ?? t.exportUnavailable,
            );
          }
          const bytes = await response.arrayBuffer();
          const digest = new Uint8Array(
            await crypto.subtle.digest("SHA-256", bytes),
          );
          const hash = Array.from(digest, (b) =>
            b.toString(16).padStart(2, "0"),
          ).join("");
          if (bytes.byteLength !== receipt.size || hash !== receipt.sha256)
            throw new Error(t.exportMismatch);
          return new Blob([bytes], { type: receipt.mediaType });
        },
        controller.signal,
      );
      if (!active() || controller.signal.aborted) return;
      setLocal({ ...state, busy: false, error: "" });
      const extension =
        receipt.mediaType === "application/zip"
          ? "zip"
          : receipt.mediaType === "text/csv"
            ? "csv"
            : "json";
      // Caller explicitly saves this verified Blob. No public URL or retained browser object URL.
      return { blob, filename: `export-${receipt.id}.${extension}` };
    } catch (error) {
      const unavailable =
        error instanceof HttpError &&
        (error.status === 404 || error.status === 410);
      const denied = treatmentDenied(error) && !unavailable;
      if (active() && !controller.signal.aborted)
        setLocal({
          owner,
          receipt: denied || unavailable ? undefined : receipt,
          error: error instanceof Error ? error.message : t.exportUnavailable,
          busy: false,
          expired: unavailable,
          denied,
        });
    } finally {
      if (downloadRequest.current === controller)
        downloadRequest.current = null;
    }
  }
  async function cleanup() {
    if (
      !operationalAllowed(identity) ||
      command.busy ||
      command.uncertain ||
      state.busy ||
      command.denied ||
      state.denied
    )
      return;
    setLocal({ ...state, busy: true, error: "" });
    try {
      const result = await treatmentRead(cache, ["exports", account], () =>
        post<{ deleted: number }>("exports/cleanup", {}),
      );
      if (active())
        setLocal({
          owner,
          receipt:
            state.receipt && Date.parse(state.receipt.expiresAt) > Date.now()
              ? state.receipt
              : undefined,
          error: "",
          busy: false,
          expired: state.expired,
        });
      return active() ? result : undefined;
    } catch (error) {
      if (active())
        setLocal({
          ...state,
          receipt: treatmentDenied(error) ? undefined : state.receipt,
          error: error instanceof Error ? error.message : t.cleanupUnavailable,
          busy: false,
          denied: treatmentDenied(error),
        });
    }
  }
  return {
    form,
    submit,
    download,
    cleanup,
    retry: () =>
      operationalAllowed(identity) && !command.denied && !state.denied
        ? command.retry()
        : Promise.resolve(undefined),
    receipt: state.receipt,
    error: state.error || command.error,
    busy: state.busy || command.busy,
    uncertain: command.uncertain,
    denied:
      !allowed(identity, form.watch()) || command.denied || !!state.denied,
    status:
      state.busy || command.busy
        ? "busy"
        : command.uncertain
          ? "uncertain"
          : state.expired
            ? "expired"
            : state.receipt
              ? "ready"
              : "idle",
  };
}
