// Minimal verification consumer; not a product page.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
const Consumer = new URLSearchParams(location.search).has("read")
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
