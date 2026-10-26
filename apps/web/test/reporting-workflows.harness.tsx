// Temporary behavior verification consumer; product pages belong to #60/#73.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Identity } from "@clinic/contracts";
import { useReport } from "../src/features/reporting/useReport.js";
import { useFollowUpForm } from "../src/features/reporting/useFollowUpForm.js";
import { useExport } from "../src/features/reporting/useExport.js";
import { useIdentitySession } from "../src/features/identity/useIdentitySession.js";
const patientId = "11111111-1111-4111-8111-111111111111";
function Consumer({ session }: { session?: Identity }) {
  const [account, setAccount] = useState("first");
  const params = new URLSearchParams(location.search);
  const identity: Identity = session ?? {
    clinicId: "clinic",
    accountId: account,
    stage: "ready",
    isManager: params.has("manager"),
    kind: params.has("doctor") ? "doctor" : "staff",
    permissions: params.has("denied")
      ? []
      : [
          "reports.operational",
          "reports.financial",
          "billing.read",
          "inventory.read",
          "exports.inventory",
        ],
    historicalOnly: params.has("historical"),
    recoverySetup: false,
    username: "fictional",
    loginMethod: "clinic_username",
    loginEmail: null,
    displayName: "Fictif",
  };
  const [date, setDate] = useState("2026-10-26");
  const read = useReport(
    identity,
    (params.get("view") ?? "financial") as "financial",
    date,
    params.get("task") ?? patientId,
  );
  const action = useFollowUpForm(
    params.has("update") ? "update" : "create",
    identity,
    params.has("update")
      ? { revision: 1, status: "completed", dueOn: "2026-10-27" }
      : { patientId: params.get("patient") ?? patientId, dueOn: "2026-10-27" },
    params.get("task") ?? patientId,
  );
  const output = useExport(identity, {
    category: (params.get("category") ?? "inventory") as "inventory",
    format: (params.get("format") ?? "json") as "json",
    ...(params.has("patient") ? { patientId: params.get("patient")! } : {}),
  });
  const [downloaded, setDownloaded] = useState("");
  return (
    <main>
      <input
        aria-label="Date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <button
        onClick={() => setAccount((a) => (a === "first" ? "second" : "first"))}
      >
        Changer de compte
      </button>
      <button onClick={() => void read.refetch()}>Actualiser</button>
      <input aria-label="Échéance" {...action.form.register("dueOn")} />
      <button onClick={() => void action.submit(true)}>Enregistrer</button>
      <button onClick={() => void action.retry()}>Réessayer</button>
      <button onClick={() => void output.submit(true)}>Exporter</button>
      <button onClick={() => void output.retry()}>Réessayer export</button>
      <button
        onClick={() =>
          void output.download().then((v) => {
            if (v) setDownloaded(String(v.blob.size));
          })
        }
      >
        Télécharger
      </button>
      <button onClick={() => void output.cleanup()}>Nettoyer</button>
      <output data-testid="export-status">{output.status}</output>
      <output data-testid="export-denied">{String(output.denied)}</output>
      <output data-testid="downloaded">{downloaded}</output>
      {output.error && <p role="alert">{output.error}</p>}
      <output data-testid="uncertain">{String(action.uncertain)}</output>
      <output data-testid="busy">{String(action.busy)}</output>
      {action.error && <p role="alert">{action.error}</p>}
      <pre data-testid="data">{JSON.stringify(read.data)}</pre>
      <output data-testid="denied">{String(read.denied)}</output>
      {read.error && <p role="alert">{read.error.message}</p>}
      <span hidden>{patientId}</span>
    </main>
  );
}
function LiveConsumer() {
  const { identity } = useIdentitySession();
  return identity ? (
    <Consumer session={identity} />
  ) : (
    <p>Session indisponible</p>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      {new URLSearchParams(location.search).has("live") ? (
        <LiveConsumer />
      ) : (
        <Consumer />
      )}
    </QueryClientProvider>
  </StrictMode>,
);
