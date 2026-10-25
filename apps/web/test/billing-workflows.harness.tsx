// Verification consumer only; product billing UI belongs to #69/#70.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBillingForm } from "../src/features/billing/useBillingForm.js";
import { useBillingDocument } from "../src/features/billing/useBillingDocument.js";
import { useBillingWorkspace } from "../src/features/billing/useBillingWorkspace.js";
import { identityScope } from "../src/features/identity/identity.workflow.js";
import { useIdentitySession } from "../src/features/identity/useIdentitySession.js";
import type { Identity } from "@clinic/contracts";
const chargeId = "11111111-1111-4111-8111-111111111111";
function Consumer() {
  const [patient, setPatient] = useState("first");
  const action = useBillingForm("settlement", "actor", patient, {
    currency: "EUR",
    methodId: "22222222-2222-4222-8222-222222222222",
    newMoney: "0",
    deposit: "0",
    allocations: [{ chargeId, newMoney: "50", credit: "30" }],
  });
  return (
    <main>
      <input
        aria-label="Nouveaux fonds"
        {...action.form.register("newMoney")}
      />
      <button onClick={() => void action.submit(false)}>
        Sans confirmation
      </button>
      <button onClick={() => void action.submit(true)}>Confirmer</button>
      <button onClick={() => void action.retry()}>Réessayer</button>
      <button onClick={() => setPatient("second")}>Changer de patient</button>
      <output data-testid="uncertain">{String(action.uncertain)}</output>
      <output data-testid="busy">{String(action.busy)}</output>
      {action.error && <p role="alert">{action.error}</p>}
    </main>
  );
}
function Documents({
  identity,
  patient,
}: {
  identity: Identity;
  patient: string;
}) {
  const [selected, setSelected] = useState("first");
  const workspace = useBillingWorkspace(identity, patient);
  const account = identityScope(identity);
  const doc = useBillingDocument(
    account,
    patient,
    location.search.includes("summary")
      ? { kind: "summary", planId: "plan" }
      : {
          kind: "settlement",
          id: selected,
        },
  );
  const credit = useBillingForm("credit", account, patient, {
    chargeId,
    revision: 0,
    finalCharge: "60",
    reason: "Correction explicite",
  });
  return (
    <section>
      <pre data-testid="workspace">{JSON.stringify(workspace.data)}</pre>
      <pre data-testid="document">{JSON.stringify(doc.data)}</pre>
      <button onClick={() => void workspace.refetch()}>Actualiser</button>
      <button onClick={() => void doc.prepare()}>Lire le reçu</button>
      <button onClick={() => void doc.authorize("print")}>Imprimer</button>
      <button onClick={() => void doc.authorize("download")}>
        Télécharger
      </button>
      <button onClick={() => setSelected("second")}>Autre reçu</button>
      <button onClick={() => void credit.submit(true)}>
        Ajuster la charge
      </button>
      {doc.error && <p role="alert">{doc.error}</p>}
    </section>
  );
}
const identity: Identity = {
  clinicId: "clinic",
  accountId: "actor",
  stage: "ready",
  isManager: false,
  kind: "staff",
  permissions: ["billing.read"],
  historicalOnly: false,
  recoverySetup: false,
  username: "staff",
  loginMethod: "clinic_username",
  loginEmail: null,
  displayName: "Employé fictif",
};
function ReadConsumer() {
  return <Documents identity={identity} patient="first" />;
}
function LiveConsumer() {
  const session = useIdentitySession();
  return session.identity ? (
    <LiveBilling identity={session.identity} />
  ) : (
    <p>Connexion</p>
  );
}
function LiveBilling({ identity }: { identity: Identity }) {
  const patient = new URLSearchParams(location.search).get("patient")!;
  const account = identityScope(identity);
  const opening = useBillingForm("opening", account, patient, {
    id: crypto.randomUUID(),
    currency: "MRU",
    amount: "70",
    provenance: "Solde documenté fictif",
    asOf: "2026-10-25T00:00:00.000Z",
  });
  const deposit = useBillingForm("settlement", account, patient, {
    currency: "MRU",
    methodId: new URLSearchParams(location.search).get("method"),
    newMoney: "120",
    deposit: "120",
    allocations: [],
  });
  const workspace = useBillingWorkspace(identity, patient);
  const [receipt, setReceipt] = useState("");
  const doc = useBillingDocument(account, patient, {
    kind: "settlement",
    id: receipt,
  });
  return (
    <main>
      <button onClick={() => void opening.submit(true)}>Solde initial</button>
      <button onClick={() => void deposit.submit(true)}>Dépôt</button>
      <button
        onClick={() => setReceipt(workspace.data?.settlements[0]?.id ?? "")}
      >
        Choisir reçu
      </button>
      <button onClick={() => void doc.authorize("print")}>Imprimer reçu</button>
      <pre data-testid="workspace">{JSON.stringify(workspace.data)}</pre>
      <pre data-testid="document">{JSON.stringify(doc.data)}</pre>
      {(opening.error || deposit.error || doc.error) && (
        <p role="alert">{opening.error || deposit.error || doc.error}</p>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {location.search.includes("live") ? (
        <LiveConsumer />
      ) : location.search.includes("read") ? (
        <ReadConsumer />
      ) : (
        <Consumer />
      )}
    </QueryClientProvider>
  </StrictMode>,
);
