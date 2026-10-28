import { z } from "zod";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Identity,
  Consultation,
  ConsultationPrice,
  Remuneration,
  TreatmentRemuneration,
} from "@clinic/contracts";
import { useCareQuery } from "../clinical/useCareQuery.js";
import { useConsultationAuthority } from "./consultation.authority.js";
import { treatmentGet } from "../treatment/treatment.api.js";
import { treatmentRead } from "../treatment/treatment.workflow.js";
import {
  activeAccount,
  activePatientScope,
  consultationAllowed,
  consultationKey,
  shareAllowed,
} from "./consultation.access.js";
export type ConsultationShare = Remuneration & {
  consultationId: string;
  currency: string;
  settlementIds: string[];
  recognizedBaseMinor: string;
  shareNumerator: string;
  shareDenominator: string;
};
function useProjection<T>(
  identity: Identity,
  patientId: string,
  accessScope: string,
  view: string,
  path: string,
  allowed: boolean,
) {
  const cache = useQueryClient();
  const key = consultationKey(identity, patientId, accessScope);
  const authority = useConsultationAuthority(identity, patientId, accessScope);
  // Reuse authorized data-free clinic invalidations; each projection is always
  // fetched again through its own permission/patient-scoped endpoint.
  const events = identity.isManager
    ? "catalog/currencies/events"
    : identity.permissions.includes("appointments.manage")
      ? "appointments/events"
      : identity.kind === "doctor" &&
          identity.permissions.includes("clinical.read")
        ? "catalog/events"
        : undefined;
  const query = useCareQuery<T>(
    [...key, view],
    path,
    events,
    allowed && !authority.suspended,
    key,
  );
  useEffect(() => {
    if (query.denied && !authority.suspended) void authority.retire();
  }, [query.denied, authority.suspended, authority.retire]);
  return {
    ...query,
    data: allowed && !authority.suspended ? query.data : undefined,
    denied: !allowed || authority.suspended || query.denied,
    refetch: async () => {
      if (!allowed) return;
      if (authority.generation === undefined) {
        await query.refetch();
        return;
      }
      const generation = authority.generation;
      let fresh = false;
      try {
        // Query may resolve a canceled refetch with reverted cached success.
        // Only this recovery's real transport success can resume its generation.
        await cache.fetchQuery({
          queryKey: [...key, view],
          staleTime: 0,
          gcTime: 0,
          retry: false,
          queryFn: ({ signal }) =>
            treatmentRead(
              cache,
              key,
              async () => {
                const value = await treatmentGet<T>(path, signal);
                if (!signal.aborted) fresh = true;
                return value;
              },
              signal,
              [...key, view],
            ),
        });
        if (fresh) authority.resume(generation);
      } catch {
        return undefined;
      }
    },
  };
}
export function useConsultations(
  identity: Identity,
  patientId: string,
  accessScope = "active",
) {
  return useProjection<Consultation[]>(
    identity,
    patientId,
    accessScope,
    "patient",
    `consultations/${encodeURIComponent(patientId)}`,
    consultationAllowed(identity) &&
      !!patientId &&
      activePatientScope(accessScope),
  );
}
export function useConsultationDay(identity: Identity, date: string) {
  const valid = z.iso.date().safeParse(date).success;
  const query = useProjection<Consultation[]>(
    identity,
    "",
    "active",
    `day:${date}`,
    `consultations?${new URLSearchParams({ date })}`,
    consultationAllowed(identity) && valid,
  );
  return { ...query, invalid: !valid };
}
export function useConsultationPrice(identity: Identity) {
  return useProjection<ConsultationPrice | null>(
    identity,
    "",
    "active",
    "price",
    "consultation-settings/price",
    consultationAllowed(identity) &&
      (identity.isManager || identity.permissions.includes("billing.read")),
  );
}
export function useRemunerationHistory(identity: Identity, doctorId: string) {
  return useProjection<{ history: Remuneration[] }>(
    identity,
    "",
    "active",
    `settings:${doctorId}`,
    `consultation-settings/remuneration/${encodeURIComponent(doctorId)}`,
    activeAccount(identity) && identity.isManager && !!doctorId,
  );
}
export function useDoctorShare(
  identity: Identity,
  patientId: string,
  source: { kind: "consultation" | "treatment"; id: string; doctorId: string },
  accessScope = "active",
) {
  const allowed =
    shareAllowed(identity, source.doctorId) &&
    !!patientId &&
    !!source.id &&
    activePatientScope(accessScope);
  const path =
    source.kind === "consultation"
      ? `consultations/${encodeURIComponent(patientId)}/${encodeURIComponent(source.id)}/remuneration`
      : `treatment/${encodeURIComponent(patientId)}/starts/${encodeURIComponent(source.id)}/remuneration`;
  return useProjection<ConsultationShare | TreatmentRemuneration | null>(
    identity,
    patientId,
    accessScope,
    `share:${source.kind}:${source.id}:${source.doctorId}`,
    path,
    allowed,
  );
}
