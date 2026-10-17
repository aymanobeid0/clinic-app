import { suggestionMessages as t } from "./reference.messages.js";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import type {
  ChartSuggestion,
  Identity,
  ClinicalWorkspace,
} from "@clinic/contracts";
import { treatmentGet } from "../treatment/treatment.api.js";
import {
  useTreatmentCommand,
  CommandState,
} from "../treatment/useTreatmentCommand.js";
const labels = {
  extraction: "Extraction / absence",
  restoration: "Restauration",
  crown: "Couronne",
  root_canal: "Traitement canalaire",
  implant: "Implant",
};
export function SuggestionsPanel({
  patientId,
  identity,
  chartRevision,
}: {
  patientId: string;
  identity: Identity;
  chartRevision: number;
}) {
  const q = useQuery({
    queryKey: [
      "chart-suggestions",
      identity.clinicId,
      identity.accountId,
      patientId,
    ],
    queryFn: () =>
      treatmentGet<ChartSuggestion[]>(`clinical/${patientId}/suggestions`),
    gcTime: 0,
    retry: false,
  });
  return (
    <section aria-label={t.title}>
      <h5>{t.heading}</h5>
      <p>{t.help}</p>
      {q.error && <p role="alert">{q.error.message}</p>}
      {q.data?.length === 0 && <p>{t.empty}</p>}
      {q.data?.map((s) => (
        <Suggestion
          key={s.id}
          value={s}
          patientId={patientId}
          revision={chartRevision}
          allowed={
            identity.kind === "doctor" &&
            identity.permissions.includes("chart.finalize")
          }
        />
      ))}
    </section>
  );
}
function Suggestion({
  value: s,
  patientId,
  revision,
  allowed,
}: {
  value: ChartSuggestion;
  patientId: string;
  revision: number;
  allowed: boolean;
}) {
  const f = useForm({
      defaultValues: { teeth: s.teeth.join(", "), surfaces: "" },
    }),
    [current, setCurrent] = useState(revision),
    [error, setError] = useState("");
  const command = useTreatmentCommand(["chart-suggestions"]);
  async function submit(action: "confirm" | "dismiss") {
    const v = f.getValues();
    const teeth = v.teeth.split(/[, ]+/).filter(Boolean),
      surfaces = v.surfaces.split(/[, ]+/).filter(Boolean);
    if (confirm(action === "confirm" ? t.confirmQuestion : t.dismissQuestion))
      await command.save(`clinical/${patientId}/suggestions/${s.id}`, {
        chartRevision: Math.max(current, revision),
        action,
        targets:
          action === "dismiss"
            ? []
            : teeth.map((tooth) => ({
                tooth,
                presence: "unknown",
                extractionHistory: false,
                conditions:
                  s.category === "restoration"
                    ? [{ finding: "restoration", surfaces }]
                    : [],
                treatments: [],
              })),
      });
  }
  return (
    <div>
      <p>
        {s.name} · {labels[s.category]} ·{" "}
        {s.status === "pending"
          ? "À confirmer"
          : s.status === "confirmed"
            ? "Confirmée"
            : "Ignorée"}
      </p>
      {s.status === "pending" && allowed && (
        <form onSubmit={f.handleSubmit(() => void submit("confirm"))}>
          <fieldset disabled={command.busy || command.uncertain}>
            <legend>{t.targets}</legend>
            <label>
              {t.teeth}
              <input required {...f.register("teeth")} />
            </label>
            {s.category === "restoration" && (
              <label>
                {t.surfaces}
                <input {...f.register("surfaces")} />
              </label>
            )}
            <button>{t.confirm}</button>
            <button type="button" onClick={() => void submit("dismiss")}>
              {t.dismiss}
            </button>
          </fieldset>
          <CommandState state={command} />
          {command.error && !command.uncertain && (
            <button
              type="button"
              onClick={() => {
                void treatmentGet<ClinicalWorkspace>(`clinical/${patientId}`)
                  .then((v) => {
                    setCurrent(v.chart.revision);
                    setError("");
                  })
                  .catch((e) =>
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Relecture indisponible.",
                    ),
                  );
              }}
            >
              {t.reload}
            </button>
          )}
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </div>
  );
}
