import type { TreatmentPlan, VisitSelection } from "@clinic/contracts";
import { useVisitStartForm } from "../src/features/treatment/useVisitStartForm.js";
// Minimal verification consumer; not a product page.
import { StrictMode, memo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { usePrescriptionEditor } from "../src/features/clinical/usePrescriptionEditor.js";
import { useCareQuery } from "../src/features/clinical/useCareQuery.js";
import { useNoteEditor } from "../src/features/clinical/useNoteEditor.js";
function NoteConsumer() {
  const [patient, setPatient] = useState("first");
  const editor = useNoteEditor(
    patient,
    {
      visitId: patient,
      revision: 0,
      current: null,
      draft: null,
      events: [],
      pending: true,
    },
    ["notes", "clinic", "actor", patient],
    () => {},
  );
  return (
    <main>
      <p>Patient : {patient}</p>
      <textarea aria-label="Note" {...editor.form.register("text")} />
      <button onClick={() => void editor.save()}>Enregistrer</button>
      <button onClick={() => setPatient("second")}>Changer de patient</button>
      <p data-testid="busy">{String(editor.busy)}</p>
      <p data-testid="uncertain">{String(editor.uncertain)}</p>
      {editor.error && <p role="alert">{editor.error}</p>}
    </main>
  );
}
function PrescriptionConsumer() {
  const [patient, setPatient] = useState("first");
  const e = usePrescriptionEditor(
    patient,
    { id: patient, revision: 0, current: null, draft: null, events: [] },
    () => {},
  );
  return (
    <main>
      <input
        aria-label="Médicament"
        {...e.form.register("content.medicines.0.name")}
      />
      <button
        onClick={() => {
          for (const field of [
            "dose",
            "route",
            "frequency",
            "duration",
          ] as const)
            e.form.setValue(
              `content.medicines.0.${field}`,
              "Saisie manuelle fictive",
            );
        }}
      >
        Compléter
      </button>
      <button onClick={() => void e.save()}>Enregistrer</button>
      <button onClick={() => setPatient("second")}>Changer de patient</button>
      <p data-testid="busy">{String(e.busy)}</p>
      <p data-testid="uncertain">{String(e.uncertain)}</p>
      {e.error && <p role="alert">{e.error}</p>}
    </main>
  );
}
function ReadConsumer() {
  const query = useCareQuery<{ text: string }[]>(
    ["notes", "clinic", "actor", "first"],
    "clinical/first/notes",
  );
  return (
    <main>
      <button onClick={() => void query.refetch()}>Relire</button>
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data && (
        <section aria-label="Dossier">
          <p>{query.data[0].text}</p>
          <textarea aria-label="Saisie locale" defaultValue="" />
        </section>
      )}
    </main>
  );
}
const SharedRead = memo(function SharedRead({ name }: { name: string }) {
  const query = useCareQuery<{ text: string }[]>(
    ["notes", "clinic", "actor", "shared"],
    "clinical/shared/notes",
  );
  return <p data-testid={name}>{query.data?.[0].text ?? "Chargement"}</p>;
});
function SharedConsumer() {
  const [first, setFirst] = useState(true);
  const cache = useQueryClient();
  return (
    <main>
      {first && <SharedRead name="first-reader" />}
      <SharedRead name="remaining-reader" />
      <button onClick={() => setFirst(false)}>
        Retirer le premier lecteur
      </button>
      <button
        onClick={() =>
          void cache.invalidateQueries({
            queryKey: ["notes", "clinic", "actor", "shared"],
          })
        }
      >
        Actualiser les lecteurs
      </button>
    </main>
  );
}
function VisitConsumer() {
  const [revision, setRevision] = useState(1),
    [submitted, setSubmitted] = useState<VisitSelection[]>([]);
  const plan: TreatmentPlan = {
    id: "plan",
    patientId: "patient",
    revision,
    title: "Plan accepté",
    currency: "MRU",
    status: "accepted",
    totalMinor: "100",
    authorId: "doctor",
    authorName: "Docteur fictif",
    recordedAt: "2026-10-25T12:00:00Z",
    events: [],
    items: [
      {
        id: "item",
        procedureId: "catalog",
        catalogRevision: 1,
        name: "Acte fictif",
        durationMinutes: 30,
        scope: "whole_mouth",
        teeth: [],
        baseMinor: "100",
        priceMinor: "100",
        discountMinor: "0",
        discountReason: "",
      },
    ],
  };
  const form = useVisitStartForm([plan], [], (selections) =>
    setSubmitted(selections),
  );
  return (
    <main>
      <input
        type="checkbox"
        aria-label="Acte"
        value="plan:item"
        {...form.f.register("selected")}
      />
      <button onClick={() => setRevision(2)}>
        Recevoir une révision distante
      </button>
      <button onClick={() => void form.onSubmit()}>
        Soumettre par une autre interface
      </button>
      <button onClick={form.review}>Relire explicitement</button>
      <p data-testid="submitted">{JSON.stringify(submitted)}</p>
      {form.f.formState.errors.selected && (
        <p role="alert">{form.f.formState.errors.selected.message}</p>
      )}
    </main>
  );
}
const Consumer = new URLSearchParams(location.search).has("visit")
  ? VisitConsumer
  : new URLSearchParams(location.search).has("shared")
    ? SharedConsumer
    : new URLSearchParams(location.search).has("read")
      ? ReadConsumer
      : new URLSearchParams(location.search).has("prescription")
        ? PrescriptionConsumer
        : NoteConsumer;
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <Consumer />
    </QueryClientProvider>
  </StrictMode>,
);
