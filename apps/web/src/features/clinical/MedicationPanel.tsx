import { referenceMessages as r } from "./reference.messages.js";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Identity,
  MedicationEntry,
  PrescriptionTemplate,
} from "@clinic/contracts";
import { treatmentGet } from "../treatment/treatment.api.js";
import {
  useTreatmentCommand,
  CommandState,
} from "../treatment/useTreatmentCommand.js";
export function MedicationPanel({ identity }: { identity: Identity }) {
  const [initialized,setInitialized]=useState(false);
  const allowed =
    identity.isManager ||
    (identity.kind === "doctor" &&
      identity.permissions.includes("prescriptions.sign"));
  return allowed ? <details onToggle={e=>{if(e.currentTarget.open)setInitialized(true);}}><summary>{r.title}</summary>{initialized&&<MedicationList identity={identity}/>}</details> : null;
}
function MedicationList({ identity }: { identity: Identity }) {
  const cache = useQueryClient(),
    key = ["medications", identity.clinicId, identity.accountId],
    query = useQuery({
      queryKey: key,
      queryFn: ({ signal }) =>
        treatmentGet<MedicationEntry[]>("medications?retired=true", signal),
      gcTime: 0,
      retry: false,
    });
  const [selected, setSelected] = useState<MedicationEntry | null>(null),
    [epoch, setEpoch] = useState(0),
    [locked, setLocked] = useState(false);
  useEffect(() => {
    const stream = new EventSource("/api/medications/events");
    const refresh = () => {
      void cache.invalidateQueries({ queryKey: ["medications"] });
    };
    stream.addEventListener("invalidate", refresh);
    stream.onerror = refresh;
    return () => stream.close();
  }, [cache]);
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
                setSelected(m);
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
          setSelected(null);
          setEpoch((v) => v + 1);
        }}
      >
        {r.new}
      </button>
      <MedicationForm key={epoch} entry={selected} onLock={setLocked} />
      {identity.isManager && <TemplateForm />}
    </section>
  );
}
function MedicationForm({
  entry,
  onLock,
}: {
  entry: MedicationEntry | null;
  onLock: (v: boolean) => void;
}) {
  const [id] = useState(() => entry?.id ?? crypto.randomUUID()),
    [revision, setRevision] = useState(entry?.revision ?? 0),
    [remote, setRemote] = useState<MedicationEntry | null>(null),
    [readError, setReadError] = useState("");
  const f = useForm({
      defaultValues: {
        name: entry?.name ?? "",
        strength: entry?.strength ?? "",
        form: entry?.form ?? "",
        active: entry?.active ?? true,
      },
    }),
    command = useTreatmentCommand<MedicationEntry>(
      ["medications"],
      (v) => {
        setRevision(v.revision);
        f.reset(f.getValues());
      },
      undefined,
      r.saved,
    );
  useEffect(() => {
    onLock(command.busy || command.uncertain || f.formState.isDirty);
    return () => onLock(false);
  }, [onLock, command.busy, command.uncertain, f.formState.isDirty]);
  return (
    <form
      onSubmit={f.handleSubmit((v) => {
        void command.save("medications", { ...v, id, revision });
      })}
    >
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
        <button
          type="button"
          onClick={() => {
            void treatmentGet<MedicationEntry[]>("medications?retired=true")
              .then((rows) => {
                const value = rows.find((m) => m.id === id) ?? null;
                setRemote(value);
                setRevision(value?.revision ?? 0);
                setReadError("");
              })
              .catch((e) =>
                setReadError(
                  e instanceof Error ? e.message : "Relecture indisponible.",
                ),
              );
          }}
        >
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
    </form>
  );
}
function TemplateForm() {
  const query = useQuery({
    queryKey: ["prescription-template"],
    queryFn: () => treatmentGet<PrescriptionTemplate>("prescription-template"),
    retry: false,
    gcTime: 0,
  });
  return (
    <details>
      <summary>{r.templateTitle}</summary>
      {query.data && (
        <TemplateEditor key={query.data.revision} value={query.data} />
      )}{" "}
      {query.error && <p role="alert">{query.error.message}</p>}
    </details>
  );
}
function TemplateEditor({ value }: { value: PrescriptionTemplate }) {
  const f = useForm({
      defaultValues: { header: value.header, footer: value.footer },
    }),
    command = useTreatmentCommand(["prescription-template"]);
  return (
    <form
      onSubmit={f.handleSubmit((v) => {
        void command.save("prescription-template", {
          ...v,
          revision: value.revision,
        });
      })}
    >
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
    </form>
  );
}
