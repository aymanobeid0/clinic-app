// Test-only rendered consumer, not an application page.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTreatmentCommand } from "../src/features/treatment/useTreatmentCommand.js";
import { useTreatmentRead } from "../src/features/treatment/useTreatmentRead.js";
import { treatmentGet } from "../src/features/treatment/treatment.api.js";
function Consumer() {
  const [patient, setPatient] = useState("first");
  const command = useTreatmentCommand(["plans", "clinic", "actor", patient]);
  const version = useTreatmentRead<{ title: string }>([
    "plans",
    "clinic",
    "actor",
    patient,
  ]);
  return (
    <main>
      <p>Patient : {patient}</p>
      <button onClick={() => setPatient("second")}>Changer de patient</button>
      <button
        onClick={() => {
          void command.save(`treatment/${patient}/plans`, { title: "Fictif" });
          void command.save(`treatment/${patient}/plans`, { title: "Fictif" });
        }}
      >
        Enregistrer deux fois
      </button>
      <button onClick={() => void command.retry()}>Réessayer</button>
      <button
        onClick={() =>
          void version.read((signal) =>
            treatmentGet(`treatment/${patient}/version`, signal),
          )
        }
      >
        Charger la version
      </button>
      <button onClick={version.clear}>Fermer la version</button>
      <p data-testid="version">{version.data?.title ?? ""}</p>
      {version.error && <p role="alert">{version.error}</p>}
      <p role="status">{command.notice}</p>
      <p data-testid="busy">{String(command.busy)}</p>
      <p data-testid="uncertain">{String(command.uncertain)}</p>
      {command.error && <p role="alert">{command.error}</p>}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <Consumer />
    </QueryClientProvider>
  </StrictMode>,
);
