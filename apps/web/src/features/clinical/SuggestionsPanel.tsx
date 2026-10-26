import { ValidatedForm } from "../../forms/ValidatedForm.js";
import { suggestionMessages as t } from "./reference.messages.js";
import { useState } from "react";
import { useCareQuery } from "./useCareQuery.js";
import { useChartSuggestion } from "./useChartSuggestion.js";
import type { ChartSuggestion, Identity } from "@clinic/contracts";
import { CommandState } from "../treatment/useTreatmentCommand.js";
const labels = {
  extraction: "Extraction / absence",
  restoration: "Restauration",
  crown: "Couronne",
  root_canal: "Traitement canalaire",
  implant: "Implant",
};
function SuggestionList({
  patientId,
  identity,
  chartRevision,
}: {
  patientId: string;
  identity: Identity;
  chartRevision: number;
}) {
  const q = useCareQuery<ChartSuggestion[]>(
    ["chart-suggestions", identity.clinicId, identity.accountId, patientId],
    `clinical/${patientId}/suggestions`,
  );
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
          identity={identity}
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
  identity,
}: {
  value: ChartSuggestion;
  patientId: string;
  revision: number;
  allowed: boolean;
  identity: Identity;
}) {
  const { f, command, submit, reload, error } = useChartSuggestion(
    s,
    patientId,
    revision,
    identity,
  );
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
        <ValidatedForm
          onSubmit={f.handleSubmit(() => {
            if (confirm(t.confirmQuestion)) void submit("confirm");
          })}
        >
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
            <button
              type="button"
              onClick={() => {
                if (confirm(t.dismissQuestion)) void submit("dismiss");
              }}
            >
              {t.dismiss}
            </button>
          </fieldset>
          <CommandState state={command} />
          {command.error && !command.uncertain && (
            <button type="button" onClick={() => void reload()}>
              {t.reload}
            </button>
          )}
          {error && <p role="alert">{error}</p>}
        </ValidatedForm>
      )}
    </div>
  );
}

export function SuggestionsPanel(props: Parameters<typeof SuggestionList>[0]) {
  const [initialized, setInitialized] = useState(false);
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open) setInitialized(true);
      }}
    >
      <summary>{t.title}</summary>
      {initialized && <SuggestionList {...props} />}
    </details>
  );
}
