import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  prescriptionDraftSchema,
  type Prescription,
  type PrescriptionContent,
} from "@clinic/contracts";
import { post, HttpError } from "../identity/identity.api.js";
import { useClinicalDraftScope } from "./useClinicalDraftScope.js";
import {
  treatmentDenied,
  treatmentRead,
} from "../treatment/treatment.workflow.js";
import { treatmentGet } from "../treatment/treatment.api.js";
export const emptyMedicine = {
  name: "",
  strength: "",
  form: "",
  dose: "",
  route: "",
  frequency: "",
  duration: "",
  quantity: "",
  instructions: "",
};
type Values = {
  content: Pick<PrescriptionContent, "medicines" | "instructions">;
  reason: string;
};
function values(record: Prescription): Values {
  const c = record.draft?.content ?? record.current?.content;
  return {
    content: {
      medicines: c?.medicines ?? [{ ...emptyMedicine }],
      instructions: c?.instructions ?? "",
    },
    reason: record.draft?.content.reason ?? "",
  };
}
export function usePrescriptionEditor(
  patientId: string,
  record: Prescription,
  onLock: (kind: string, value: boolean) => void,
  cacheKey: string[] = ["prescriptions", patientId],
) {
  const cache = useQueryClient(),
    path = `clinical/${patientId}/prescriptions/${record.id}`;
  const { owner, active, compared, setCompared } =
    useClinicalDraftScope<Prescription>([...cacheKey, record.id]);
  const initial = values(record),
    form = useForm<Values>({ defaultValues: initial });
  const value = form.watch(),
    serialized = JSON.stringify(value);
  const [saved, setSaved] = useState(JSON.stringify(initial)),
    [revision, setRevision] = useState(record.revision),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(false),
    [conflict, setConflict] = useState(false),
    [denied, setDenied] = useState(false);
  const pending = useRef<{
      action: "draft" | "finalize";
      data: object;
      serialized?: string;
    } | null>(null),
    flight = useRef(false);
  useEffect(() => {
    const v = values(record);
    form.reset(v);
    setSaved(JSON.stringify(v));
    setRevision(record.revision);
    setBusy(false);
    setError("");
    setUncertain(false);
    setConflict(false);
    setDenied(false);
    setCompared(null);
    pending.current = null;
    flight.current = false;
  }, [owner]);
  const dirty = serialized !== saved,
    locked = dirty || busy || uncertain || conflict;
  useEffect(() => {
    onLock("prescription:" + record.id, locked);
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    if (locked) window.addEventListener("beforeunload", warn);
    return () => {
      onLock("prescription:" + record.id, false);
      window.removeEventListener("beforeunload", warn);
    };
  }, [record.id, onLock, locked]);
  async function save(action: "draft" | "finalize" = "draft") {
    if (!active() || denied || flight.current || conflict) return;
    const v = form.getValues();
    if (
      !pending.current &&
      action === "draft" &&
      !prescriptionDraftSchema.safeParse({
        commandId: crypto.randomUUID(),
        revision,
        ...v,
      }).success
    ) {
      setError(
        "Complétez les champs obligatoires et le motif de correction avant enregistrement.",
      );
      return;
    }
    if (!pending.current && action === "finalize" && (dirty || !record.draft))
      return;
    pending.current ??= {
      action,
      data: {
        commandId: crypto.randomUUID(),
        revision,
        ...(action === "draft" ? structuredClone(v) : {}),
      },
      ...(action === "draft" ? { serialized: JSON.stringify(v) } : {}),
    };
    const request = pending.current;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await post<Prescription>(
        `${path}/${request.action}`,
        request.data,
      );
      if (!active()) return;
      pending.current = null;
      setUncertain(false);
      setRevision(result.revision);
      if (request.serialized) setSaved(request.serialized);
      cache.setQueryData<Prescription[]>(cacheKey, (rows) =>
        rows
          ? rows.some((r) => r.id === result.id)
            ? rows.map((r) =>
                r.id === result.id && r.revision <= result.revision
                  ? result
                  : r,
              )
            : [...rows, result]
          : [result],
      );
      await cache.invalidateQueries({ queryKey: cacheKey });
    } catch (e) {
      if (!active()) return;
      if (treatmentDenied(e)) {
        setDenied(true);
        form.reset({
          content: { medicines: [{ ...emptyMedicine }], instructions: "" },
          reason: "",
        });
        setCompared(null);
        await treatmentRead(cache, cacheKey, () => Promise.reject(e)).catch(
          () => {},
        );
        if (!active()) return;
      }
      setError(e instanceof Error ? e.message : "Service indisponible.");
      if (e instanceof HttpError && e.status < 500) {
        pending.current = null;
        setUncertain(false);
        setConflict(e.status === 409);
      } else setUncertain(true);
    } finally {
      if (active()) {
        flight.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    if (
      !denied &&
      !dirty &&
      !busy &&
      !uncertain &&
      !conflict &&
      record.revision > revision
    ) {
      const v = values(record);
      form.reset(v);
      setSaved(JSON.stringify(v));
      setRevision(record.revision);
    }
  }, [record, dirty, busy, uncertain, conflict, revision, form]);
  useEffect(() => {
    if (!dirty || busy || uncertain || conflict || error) return;
    if (
      !prescriptionDraftSchema.safeParse({
        commandId: crypto.randomUUID(),
        revision,
        ...value,
      }).success
    )
      return;
    const timer = setTimeout(() => {
      void save();
    }, 800);
    return () => clearTimeout(timer);
  });
  async function compare() {
    if (!active() || denied || flight.current || uncertain) return;
    flight.current = true;
    setBusy(true);
    try {
      const result = await treatmentRead(
        cache,
        cacheKey,
        () => treatmentGet<Prescription>(path, owner.controller.signal),
        owner.controller.signal,
      );
      if (!active()) return;
      setCompared(result);
      setConflict(true);
    } catch (e) {
      if (!active()) return;
      if (treatmentDenied(e)) {
        setDenied(true);
        form.reset({
          content: { medicines: [{ ...emptyMedicine }], instructions: "" },
          reason: "",
        });
        setCompared(null);
      }
      setError(e instanceof Error ? e.message : "Relecture indisponible.");
    } finally {
      if (active()) {
        flight.current = false;
        setBusy(false);
      }
    }
  }
  function resolve(keep: boolean) {
    if (!active() || denied || !compared) return;
    const v = values(compared);
    setRevision(compared.revision);
    setSaved(JSON.stringify(v));
    if (!keep) form.reset(v);
    setCompared(null);
    setConflict(false);
    setError("");
    void cache.invalidateQueries({ queryKey: cacheKey });
  }
  return {
    form,
    dirty,
    revision,
    busy,
    error,
    uncertain,
    conflict,
    compared,
    denied,
    save,
    compare,
    resolve,
  };
}
