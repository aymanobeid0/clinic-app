import { useVisits } from "./useVisits.js";
import { NotesPanel } from "../clinical/NotesPanel.js";
import { VisitStartForm } from "./VisitStartForm.js";
import type { Identity, TreatmentPlan } from "@clinic/contracts";
import { CommandState } from "./useTreatmentCommand.js";
import { visitMessages as t } from "./visit.messages.js";
export function VisitPanel({
  patientId,
  identity,
  plans,
  onLock,
  dirty,
}: {
  patientId: string;
  identity: Identity;
  plans: TreatmentPlan[];
  onLock: (kind: string, v: boolean) => void;
  dirty: boolean;
}) {
  const {
    query,
    epoch,
    command,
    forbidden,
    data,
    active,
    busy,
    choices,
    start,
    complete,
    end,
  } = useVisits(patientId, identity, plans, onLock);
  if (forbidden) return <p role="alert">{query.error!.message}</p>;
  return (
    <section className="treatment visits" aria-label={t.title}>
      <h4>{t.title}</h4>
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.isPending && <p role="status">{t.loading}</p>}
      {data && (
        <>
          <p>{t.startedCount(data.starts.length)}</p>
          <p>{t.completedCount(data.completions.length)}</p>
          {identity.kind === "doctor" &&
            identity.permissions.includes("procedures.start") &&
            choices.length > 0 && (
              <VisitStartForm
                key={epoch}
                plans={choices}
                appointments={data.appointments}
                disabled={!!active || busy || dirty}
                completions={data.completions}
                submit={(procedures, appointmentId) => {
                  if (confirm(t.confirmStart))
                    void start(procedures, appointmentId);
                }}
              />
            )}
          {data.visits.length === 0 && <p>{t.empty}</p>}
          <ol>
            {data.visits.map((v) => (
              <li key={v.id} className="visit-record">
                <h5>{v.status === "draft" ? t.draft : t.ended}</h5>
                <p>
                  {v.doctorName} · {new Date(v.startedAt).toLocaleString("fr")}{" "}
                  · {v.appointmentId ? t.linkedAppointment : t.walkIn} ·{" "}
                  {t.version} {v.revision}
                </p>
                <ul>
                  {v.procedures.map((p, index) => {
                    const completed = data.completions.find(
                      (c) => c.planId === p.planId && c.itemId === p.itemId,
                    );
                    return (
                      <li key={`${p.planId}:${p.itemId}`}>
                        {p.name} · {completed ? t.completed : t.inProgress}
                        {completed && (
                          <span>
                            {" "}
                            · {completed.completedByName} ·{" "}
                            {new Date(completed.at).toLocaleString("fr")}
                          </span>
                        )}
                        {v.status === "draft" &&
                          v.doctorId === identity.accountId &&
                          identity.permissions.includes(
                            "procedures.complete",
                          ) &&
                          !completed && (
                            <button
                              type="button"
                              disabled={busy || dirty}
                              onClick={() => {
                                if (confirm(t.confirmComplete))
                                  void complete(v, p.planId, p.itemId);
                              }}
                            >
                              {t.completeAct(index + 1, p.name)}
                            </button>
                          )}
                      </li>
                    );
                  })}
                </ul>
                {v.endedAt && (
                  <p>{t.careEnded(new Date(v.endedAt).toLocaleString("fr"))}</p>
                )}
                {v.status === "draft" &&
                  v.doctorId === identity.accountId &&
                  identity.permissions.includes("procedures.start") && (
                    <button
                      type="button"
                      disabled={busy || dirty}
                      onClick={() => {
                        if (confirm(t.confirmEnd)) void end(v);
                      }}
                    >
                      {t.end}
                    </button>
                  )}
              </li>
            ))}
          </ol>
          {data.visits.length > 0 && (
            <NotesPanel
              patientId={patientId}
              identity={identity}
              visits={data.visits}
              onLock={onLock}
            />
          )}
        </>
      )}
      <CommandState state={command} />
    </section>
  );
}
