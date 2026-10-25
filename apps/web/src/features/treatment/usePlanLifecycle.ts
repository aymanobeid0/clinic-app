import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Identity, TreatmentPlan, PlanEvidence } from "@clinic/contracts";
import { useTreatmentCommand } from "./useTreatmentCommand.js";
import { useTreatmentRead } from "./useTreatmentRead.js";
import { treatmentGet, type PrintablePlan } from "./treatment.api.js";
import { planLifecycleMessages as t } from "./treatment.messages.js";
export function usePlanLifecycle({
  plan,
  patientId,
  identity,
  cacheKey,
  onLock,
  dirty,
  onDone,
}: {
  plan: TreatmentPlan;
  patientId: string;
  identity: Identity;
  cacheKey: string[];
  onLock: (kind: string, v: boolean) => void;
  dirty: boolean;
  onDone: (plan: TreatmentPlan) => void;
}) {
  const f = useForm<{
    acceptedBy: string;
    acceptedAt: string;
    method: string;
    reason: string;
  }>();
  const printState = useTreatmentRead<PrintablePlan>(cacheKey);
  const [printRevision, setPrintRevision] = useState("");
  const [reviewedRevision, setReviewedRevision] = useState(plan.revision);
  const [reviewing, setReviewing] = useState(false);
  const command = useTreatmentCommand<TreatmentPlan>(
    cacheKey,
    onDone,
    onLock,
    t.saved,
  );
  const send = (
    action: "present" | "accept" | "evidence" | "cancel",
    extra: object = {},
    confirmed = false,
  ) => {
    const allowed = {
      present: canPresent,
      accept: canAccept,
      evidence: canRecordEvidence,
      cancel: canCancel,
    };
    if (
      confirmed &&
      allowed[action] &&
      !dirty &&
      !command.busy &&
      !command.uncertain &&
      plan.revision === reviewedRevision
    )
      void command.save(`treatment/${patientId}/plans/lifecycle`, {
        id: plan.id,
        revision: reviewedRevision,
        action,
        ...extra,
      });
  };

  const doctor = identity.kind === "doctor" && !identity.historicalOnly;
  const canPresent =
    doctor &&
    plan.status === "draft" &&
    identity.permissions.includes("plans.finalize");
  const canAccept =
    doctor &&
    plan.status === "presented" &&
    !!plan.evidence &&
    identity.permissions.includes("plans.accept");
  const canCancel =
    doctor &&
    ["draft", "presented", "accepted"].includes(plan.status) &&
    identity.permissions.includes("plans.finalize");
  const canRecordEvidence =
    !identity.historicalOnly &&
    plan.status === "presented" &&
    identity.permissions.includes("acceptance.draft");
  const canPrint =
    !identity.historicalOnly && identity.permissions.includes("clinical.print");
  function preview() {
    if (canPrint)
      void printState.read((signal) =>
        treatmentGet<PrintablePlan>(
          `treatment/${patientId}/plans/${plan.id}/versions/${printRevision || plan.revision}/print`,
          signal,
        ),
      );
  }
  const evidence = (
    confirmed: boolean,
    attachment?: PlanEvidence["attachment"],
  ) =>
    f.handleSubmit((v) => {
      const date = new Date(v.acceptedAt);
      if (!Number.isFinite(date.getTime())) {
        f.setError("acceptedAt", { message: "Date invalide." });
        return;
      }
      send(
        "evidence",
        {
          acceptedBy: v.acceptedBy,
          method: v.method,
          acceptedAt: date.toISOString(),
          ...(attachment ? { attachment } : {}),
        },
        confirmed,
      );
    });
  const cancel = (confirmed: boolean) =>
    f.handleSubmit((v) => send("cancel", { reason: v.reason }, confirmed));
  function review() {
    setReviewedRevision(plan.revision);
    setReviewing(true);
  }
  return {
    f,
    command,
    evidence,
    cancel,
    send,
    reviewedRevision,
    reviewing,
    review,
    printState,
    printRevision,
    setPrintRevision,
    preview,
    canPresent,
    canAccept,
    canCancel,
    canRecordEvidence,
    canPrint,
  };
}
