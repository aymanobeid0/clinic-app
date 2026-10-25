// Temporary verification consumer. Product UI belongs to #71/#72.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Identity } from "@clinic/contracts";
import { useInventoryForm } from "../src/features/inventory/useInventoryForm.js";
import { useInventory } from "../src/features/inventory/useInventory.js";
import type { InventoryAction } from "../src/features/inventory/inventory.actions.js";
const batchId = "11111111-1111-4111-8111-111111111111";
function Consumer() {
  const [account, setAccount] = useState("first");
  const [payload, setPayload] = useState("");
  const params = new URLSearchParams(location.search);
  const actionName = (params.get("action") ?? "correction") as InventoryAction;
  const identity: Identity = {
    clinicId: "clinic",
    accountId: account,
    stage: "ready",
    isManager: params.has("manager"),
    kind: "staff",
    permissions: location.search.includes("denied")
      ? []
      : [
          "inventory.read",
          "inventory.receive",
          "inventory.consume",
          "inventory.adjust",
        ],
    historicalOnly: false,
    recoverySetup: false,
    username: "fictional",
    loginMethod: "clinic_username",
    loginEmail: null,
    displayName: "Fictif",
  };
  const read = useInventory(identity);
  const action = useInventoryForm(
    actionName,
    identity,
    {
      kind: "waste",
      batchId,
      revision: 0,
      quantityPacks: 1,
      reason: "Paquet endommagé",
    },
    params.get("target") ?? "",
  );
  return (
    <main>
      <textarea
        aria-label="Payload"
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
      />
      <button onClick={() => action.form.reset(JSON.parse(payload))}>
        Préparer
      </button>
      {!params.has("action") && (
        <>
          <input
            aria-label="Paquets"
            {...action.form.register("quantityPacks", { valueAsNumber: true })}
          />
          <input aria-label="Motif" {...action.form.register("reason")} />
        </>
      )}
      <button onClick={() => void action.submit(false)}>
        Sans confirmation
      </button>
      <button onClick={() => void action.submit(true)}>Confirmer</button>
      <button onClick={() => void action.retry()}>Réessayer</button>
      <button onClick={() => setAccount("second")}>Changer de compte</button>
      <button onClick={() => void read.refetch()}>Actualiser</button>
      <output data-testid="busy">{String(action.busy)}</output>
      <output data-testid="uncertain">{String(action.uncertain)}</output>
      <output data-testid="denied">
        {String(action.denied || read.denied)}
      </output>
      <pre data-testid="stock">{JSON.stringify(read.data)}</pre>
      {action.error && <p role="alert">{action.error}</p>}
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
