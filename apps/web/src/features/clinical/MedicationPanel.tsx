import { FormErrors } from "../../forms/FormErrors.js";
import { ValidatedForm } from "../../forms/ValidatedForm.js";
import {
  useMedicationReferences,
  useMedicationForm,
  usePrescriptionTemplate,
  usePrescriptionTemplateForm,
} from "./useMedicationReferences.js";
import { referenceMessages as r } from "./reference.messages.js";
import { useState } from "react";
import type {
  Identity,
  MedicationEntry,
  PrescriptionTemplate,
} from "@clinic/contracts";
import { CommandState } from "../treatment/useTreatmentCommand.js";
export function MedicationPanel({ identity }: { identity: Identity }) {
  const [initialized, setInitialized] = useState(false);
  const allowed =
    identity.isManager ||
    (identity.kind === "doctor" &&
      identity.permissions.includes("prescriptions.sign"));
  return allowed ? (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open) setInitialized(true);
      }}
    >
      <summary>{r.title}</summary>
      {initialized && <MedicationList identity={identity} />}
    </details>
  ) : null;
}
function MedicationList({ identity }: { identity: Identity }) {
  const { query } = useMedicationReferences(identity);
  const [selectedId, setSelectedId] = useState(""),
    [epoch, setEpoch] = useState(0),
    [locked, setLocked] = useState(false);
  const selected = query.data?.find((m) => m.id === selectedId) ?? null;
  return (
    <section aria-label={r.title} className="treatment">
      <h3>{r.title}</h3>
      <p>{r.help}</p>
      {query.isPending && <p role="status">{r.loading}</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data?.length === 0 && <p>{r.empty}</p>}
      <ul>
        {query.data?.map((m) => (
          <li key={m.id}>
            <button
              disabled={locked}
              onClick={() => {
                setSelectedId(m.id);
                setEpoch((v) => v + 1);
              }}
            >
              {m.name} · {m.strength} · {m.form} ·{" "}
              {m.active ? "Disponible" : "Retirée"}
            </button>
          </li>
        ))}
      </ul>
      <button
        disabled={locked}
        onClick={() => {
          setSelectedId("");
          setEpoch((v) => v + 1);
        }}
      >
        {r.new}
      </button>
      {!query.denied && (
        <MedicationForm
          key={epoch}
          entry={selected}
          onLock={setLocked}
          identity={identity}
        />
      )}
      {identity.isManager && <TemplateForm identity={identity} />}
    </section>
  );
}
function MedicationForm({
  entry,
  onLock,
  identity,
}: {
  entry: MedicationEntry | null;
  onLock: (v: boolean) => void;
  identity: Identity;
}) {
  const { f, command, remote, readError, reload, submit } = useMedicationForm(
    entry,
    onLock,
    identity,
  );
  return (
    <ValidatedForm onSubmit={submit}>
      <fieldset disabled={command.busy || command.uncertain}>
        <legend>{entry ? r.edit : r.add}</legend>
        <label>
          {r.name}
          <input required maxLength={160} {...f.register("name")} />
        </label>
        <label>
          {r.strength}
          <input maxLength={100} {...f.register("strength")} />
        </label>
        <label>
          {r.form}
          <input maxLength={100} {...f.register("form")} />
        </label>
        <label>
          <input type="checkbox" {...f.register("active")} />
          {r.available}
        </label>
        <button>{r.save}</button>
      </fieldset>
      <CommandState state={command} />
      {command.error && !command.uncertain && (
        <button type="button" onClick={() => void reload()}>
          {r.reload}
        </button>
      )}
      {remote && (
        <p>
          Version distante {remote.revision} : {remote.name} · {remote.strength}{" "}
          · {remote.form}. Vérifiez votre saisie conservée avant enregistrement.
        </p>
      )}
      {readError && <p role="alert">{readError}</p>}
    <FormErrors errors={f.formState.errors} />
</ValidatedForm>
  );
}
function TemplateForm({ identity }: { identity: Identity }) {
  const query = usePrescriptionTemplate(identity);
  return (
    <details>
      <summary>{r.templateTitle}</summary>
      {query.data && (
        <TemplateEditor
          key={query.data.revision}
          value={query.data}
          identity={identity}
        />
      )}{" "}
      {query.error && <p role="alert">{query.error.message}</p>}
    </details>
  );
}
function TemplateEditor({
  value,
  identity,
}: {
  value: PrescriptionTemplate;
  identity: Identity;
}) {
  const { f, command, submit } = usePrescriptionTemplateForm(value, identity);
  return (
    <ValidatedForm onSubmit={submit}>
      <fieldset disabled={command.busy || command.uncertain}>
        <legend>{r.templateLegend}</legend>
        <p>{r.templateHelp}</p>
        <label>
          {r.header}
          <textarea {...f.register("header")} />
        </label>
        <label>
          {r.footer}
          <textarea {...f.register("footer")} />
        </label>
        <button>{r.saveTemplate}</button>
      </fieldset>
      <CommandState state={command} />
    <FormErrors errors={f.formState.errors} />
</ValidatedForm>
  );
}
