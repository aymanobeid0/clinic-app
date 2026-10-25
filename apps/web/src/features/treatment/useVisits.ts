import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Identity,
  TreatmentPlan,
  Visit,
  VisitState,
  VisitSelection,
} from "@clinic/contracts";
import { HttpError } from "../identity/identity.api.js";
import { useCareQuery } from "../clinical/useCareQuery.js";
import { useTreatmentCommand } from "./useTreatmentCommand.js";
import { visitMessages as t } from "./visit.messages.js";
export function useVisits(
  patientId: string,
  identity: Identity,
  plans: TreatmentPlan[],
  onLock: (kind: string, value: boolean) => void,
) {
  const cache = useQueryClient(),
    key = ["visits", identity.clinicId, identity.accountId, patientId];
  const query = useCareQuery<VisitState>(key, `treatment/${patientId}/visits`);
  const [epoch, setEpoch] = useState(0);
  const lock = useCallback(
    (_kind: string, value: boolean) => onLock("visit", value),
    [onLock],
  );
  const command = useTreatmentCommand<Visit>(
    key,
    () => {
      setEpoch((x) => x + 1);
      void cache.invalidateQueries({
        queryKey: ["plans", identity.clinicId, identity.accountId, patientId],
      });
    },
    lock,
    t.saved,
  );
  const forbidden =
    query.error instanceof HttpError &&
    [401, 403, 404].includes(query.error.status);

  const data = query.data,
    active = data?.visits.find(
      (v) => v.status === "draft" && v.doctorId === identity.accountId,
    );
  const busy = command.busy || command.uncertain;
  const choices = plans.filter((p) =>
    ["accepted", "in_progress"].includes(p.status),
  );
  return {
    query,
    epoch,
    command,
    forbidden,
    data,
    active,
    busy,
    choices,
    start: (procedures: VisitSelection[], appointmentId: string | null) =>
      command.save(`treatment/${patientId}/visits`, {
        id: crypto.randomUUID(),
        appointmentId,
        procedures,
      }),
    complete: (visit: Visit, planId: string, itemId: string) =>
      command.save(`treatment/${patientId}/visits/actions`, {
        id: visit.id,
        revision: visit.revision,
        action: "complete",
        planId,
        itemId,
      }),
    end: (visit: Visit) =>
      command.save(`treatment/${patientId}/visits/actions`, {
        id: visit.id,
        revision: visit.revision,
        action: "end",
      }),
  };
}
