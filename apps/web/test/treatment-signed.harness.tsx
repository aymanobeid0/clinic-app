// Minimal test-only consumer of the real hooks; no product page or routing.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Identity, TreatmentPlan } from "@clinic/contracts";
import { identityApi } from "../src/features/identity/identity.api.js";
import { treatmentApi } from "../src/features/treatment/treatment.api.js";
import { usePlanLifecycle } from "../src/features/treatment/usePlanLifecycle.js";
import { useAttachments } from "../src/features/attachments/useAttachments.js";

const patientId = new URLSearchParams(location.search).get("patient")!;
function Consumer({
  identity,
  plan,
}: {
  identity: Identity;
  plan: TreatmentPlan;
}) {
  const cache = useQueryClient();
  const [attachment, setAttachment] = useState<{
    id: string;
    revision: number;
  }>();
  const files = useAttachments(
    `${identity.clinicId}:${identity.accountId}`,
    patientId,
    "clinical",
  );
  const lifecycle = usePlanLifecycle({
    patientId,
    identity,
    plan,
    cacheKey: ["plans", identity.clinicId, identity.accountId, patientId],
    dirty: false,
    onLock: () => {},
    onDone: (value) => cache.setQueryData(["signed-plan"], [value]),
  });
  async function upload() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const file = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png"),
    );
    if (
      await files.upload({
        file,
        name: "Accord fictif.png",
        classification: "clinical",
      })
    ) {
      const list = await files.list.refetch();
      const file = list.data?.attachments[0];
      if (file) setAttachment({ id: file.id, revision: file.revision });
    }
  }
  return (
    <main>
      <button onClick={() => void upload()}>
        Téléverser la preuve fictive
      </button>
      <p data-testid="uploaded">{attachment?.id ?? ""}</p>
      <form onSubmit={lifecycle.evidence(true, attachment)}>
        <input aria-label="Personne" {...lifecycle.f.register("acceptedBy")} />
        <input
          aria-label="Date accord"
          {...lifecycle.f.register("acceptedAt")}
        />
        <input aria-label="Méthode" {...lifecycle.f.register("method")} />
        <button disabled={!attachment}>Lier la preuve</button>
      </form>
      <p data-testid="linked">{plan.evidence?.attachment?.id ?? ""}</p>
      <button onClick={lifecycle.review}>Relire la preuve liée</button>
      <button
        disabled={!lifecycle.canAccept}
        onClick={() => lifecycle.send("accept", {}, true)}
      >
        Confirmer
      </button>
      <p data-testid="accepted">{plan.acceptance?.attachment?.id ?? ""}</p>
      {files.error && <p role="alert">{files.error}</p>}
      {lifecycle.command.error && <p role="alert">{lifecycle.command.error}</p>}
    </main>
  );
}
function Load() {
  const identity = useQuery({
    queryKey: ["identity"],
    queryFn: ({ signal }) => identityApi.getIdentity(signal),
  });
  const plans = useQuery({
    queryKey: ["signed-plan"],
    queryFn: ({ signal }) => treatmentApi.plans(patientId, signal),
    enabled: !!identity.data,
  });
  return identity.data && plans.data?.[0] ? (
    <Consumer identity={identity.data} plan={plans.data[0]} />
  ) : (
    <p>Chargement</p>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Load />
    </QueryClientProvider>
  </StrictMode>,
);
