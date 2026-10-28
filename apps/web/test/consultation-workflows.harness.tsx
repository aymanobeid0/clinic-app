// Verification consumer only; no product layout or routing.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import type { Consultation, Identity, VisitNote } from "@clinic/contracts";
import {
  useConsultationBooking,
  useConsultationPayment,
  useConsultationPriceForm,
  useRemunerationForm,
} from "../src/features/consultations/useConsultationForms.js";
import {
  useConsultationDay,
  useConsultationPrice,
  useConsultations,
  useDoctorShare,
  useRemunerationHistory,
} from "../src/features/consultations/useConsultationQueries.js";
import { useConsultationCare } from "../src/features/consultations/useConsultationCare.js";
import { useBillingWorkspace } from "../src/features/billing/useBillingWorkspace.js";
import { useVisits } from "../src/features/treatment/useVisits.js";
import { useCareQuery } from "../src/features/clinical/useCareQuery.js";
import { useNoteEditor } from "../src/features/clinical/useNoteEditor.js";
import { identityApi } from "../src/features/identity/identity.api.js";
const actor: Identity = {
  clinicId: "clinic",
  accountId: "11111111-1111-4111-8111-111111111111",
  stage: "ready",
  kind: "doctor",
  isManager: true,
  historicalOnly: false,
  permissions: [
    "clinical.read",
    "procedures.start",
    "procedures.complete",
    "billing.read",
    "billing.edit",
  ],
  displayName: "Fictif",
  recoverySetup: false,
  username: "fictional",
  loginMethod: "clinic_username",
  loginEmail: null,
};
const params = new URLSearchParams(location.search);
function BookingConsumer({ identity }: { identity: Identity }) {
  const [patient, setPatient] = useState(
    params.get("patient") ?? "22222222-2222-4222-8222-222222222222",
  );
  const [scope, setScope] = useState("active");
  const booking = useConsultationBooking(identity, patient, scope);
  return (
    <main>
      <input aria-label="Dentiste" {...booking.form.register("doctorId")} />
      <input aria-label="Prix convenu" {...booking.form.register("price")} />
      <button onClick={() => void booking.submit()}>Réserver</button>
      <button
        onClick={() => setPatient("33333333-3333-4333-8333-333333333333")}
      >
        Changer de patient
      </button>
      <button onClick={() => setScope("denied")}>Retirer accès</button>
      <output data-testid="uncertain">
        {String(booking.command.uncertain)}
      </output>
      <output data-testid="conflict">{String(booking.command.conflict)}</output>
      <output data-testid="error">
        {booking.command.error || booking.form.formState.errors.root?.message}
      </output>
    </main>
  );
}
function CareConsumer({ identity }: { identity: Identity }) {
  const patient =
    params.get("patient") ?? "22222222-2222-4222-8222-222222222222";
  const query = useConsultations(identity, patient);
  const booking = useConsultationBooking(identity, patient);
  const day = useConsultationDay(
    identity,
    new Date().toISOString().slice(0, 10),
  );
  return (
    <main>
      <input aria-label="Prix convenu" {...booking.form.register("price")} />
      <button onClick={() => void booking.submit()}>Réserver</button>
      <button onClick={() => void query.refetch()}>Relire</button>
      <output data-testid="loading">{String(query.isLoading)}</output>
      <output data-testid="denied">{String(query.denied)}</output>
      <output data-testid="rows">{JSON.stringify(query.data)}</output>
      <output data-testid="day">{JSON.stringify(day.data)}</output>
      <output data-testid="read-error">{query.error?.message}</output>
      <output data-testid="booking-error">
        {booking.command.error || booking.form.formState.errors.root?.message}
      </output>
      {query.data?.[0] && (
        <CareActions identity={identity} consultation={query.data[0]} />
      )}
    </main>
  );
}
function NoteConsumer({
  patient,
  note,
  identity,
}: {
  patient: string;
  note: VisitNote;
  identity: Identity;
}) {
  const editor = useNoteEditor(
    patient,
    note,
    ["notes", identity.clinicId, identity.accountId, patient],
    () => {},
  );
  return (
    <section>
      <textarea aria-label="Note" {...editor.form.register("text")} />
      <button onClick={() => void editor.save()}>Sauver note</button>
      <button onClick={() => void editor.save("finalize")}>
        Finaliser note
      </button>
      <output data-testid="note-error">{editor.error}</output>
      <output data-testid="note-pending">{String(note.pending)}</output>
      <output data-testid="note-data">{JSON.stringify(note)}</output>
    </section>
  );
}
function CareActions({
  identity,
  consultation,
}: {
  identity: Identity;
  consultation: Consultation;
}) {
  const [scope, setScope] = useState("active");
  const [who, setWho] = useState(identity);
  const payment = useConsultationPayment(who, consultation, scope);
  const care = useConsultationCare(who, consultation, scope);
  const share = useDoctorShare(
    who,
    consultation.patientId,
    {
      kind: params.has("start") ? "treatment" : "consultation",
      id: params.get("start") ?? consultation.id,
      doctorId: consultation.doctorId,
    },
    scope,
  );
  const billing = useBillingWorkspace(who, consultation.patientId);
  const visits = useVisits(consultation.patientId, who, [], () => {});
  const notes = useCareQuery<VisitNote[]>(
    ["notes", who.clinicId, who.accountId, consultation.patientId],
    `clinical/${consultation.patientId}/notes`,
    undefined,
    scope === "active",
  );
  const visit = visits.data?.visits.find((v) => v.id === consultation.visitId);
  return (
    <section>
      <input aria-label="Montant reçu" {...payment.form.register("amount")} />
      <input aria-label="Méthode" {...payment.form.register("methodId")} />
      <button onClick={() => void payment.submit()}>Payer</button>
      <button onClick={() => void care.enter()}>Entrer</button>
      <button onClick={() => void care.retry()}>Réessayer entrée</button>
      <button onClick={() => void care.complete()}>
        Terminer consultation
      </button>
      <button onClick={() => setScope("denied")}>Retirer accès</button>
      <button onClick={() => setWho({ ...who, historicalOnly: true })}>
        Compte historique
      </button>
      <button
        onClick={() =>
          setWho({
            ...who,
            kind: "staff",
            isManager: false,
            permissions: ["billing.read"],
          })
        }
      >
        Compte accueil
      </button>
      <button
        onClick={() =>
          setWho({
            ...who,
            accountId: "44444444-4444-4444-8444-444444444444",
            isManager: false,
          })
        }
      >
        Autre dentiste
      </button>
      <button onClick={() => void share.refetch()}>Relire part</button>
      {visit && (
        <>
          <button
            onClick={() =>
              void visits.addProcedures(visit, [
                {
                  planId: params.get("plan")!,
                  itemId: params.get("item")!,
                  planRevision: Number(params.get("revision") ?? 2),
                },
              ])
            }
          >
            Ajouter traitement
          </button>
          <button
            onClick={() =>
              void visits.complete(
                visit,
                params.get("plan")!,
                params.get("item")!,
              )
            }
          >
            Terminer acte
          </button>
          <button onClick={() => void visits.end(visit)}>Fin soins</button>
        </>
      )}
      <output data-testid="share">{JSON.stringify(share.data)}</output>
      <output data-testid="share-denied">{String(share.denied)}</output>
      <output data-testid="share-error">{share.error?.message}</output>
      <output data-testid="billing">{JSON.stringify(billing.data)}</output>
      <output data-testid="visits">{JSON.stringify(visits.data)}</output>
      <output data-testid="payment-uncertain">
        {String(payment.command.uncertain)}
      </output>
      <output data-testid="payment-error">
        {payment.command.error || payment.form.formState.errors.root?.message}
      </output>
      <output data-testid="care-conflict">
        {String(care.command.conflict)}
      </output>
      <output data-testid="care-error">{care.command.error}</output>
      <output data-testid="visit-error">{visits.command.error}</output>
      {notes.data?.[0] && (
        <NoteConsumer
          patient={consultation.patientId}
          note={notes.data[0]}
          identity={who}
        />
      )}
    </section>
  );
}
function SettingsConsumer({ identity }: { identity: Identity }) {
  const price = useConsultationPrice(identity);
  const history = useRemunerationHistory(identity, identity.accountId);
  const p = useConsultationPriceForm(identity, price.data?.revision ?? 0);
  const r = useRemunerationForm(
    identity,
    identity.accountId,
    history.data?.history.at(-1)?.revision ?? 0,
  );
  return (
    <main>
      <output data-testid="price">{JSON.stringify(price.data)}</output>
      <output data-testid="history">{JSON.stringify(history.data)}</output>
      <input aria-label="Tarif" {...p.form.register("price")} />
      <input aria-label="Taux" {...r.form.register("rate")} />
      <button onClick={() => void p.submit()}>Sauver tarif</button>
      <button onClick={() => void r.submit()}>Sauver taux</button>
      <button
        onClick={() => {
          p.review();
          r.review();
        }}
      >
        Relire paramètres
      </button>
      <button
        onClick={() => {
          r.form.setValue("mode", "salary");
          r.form.setValue("rate", null);
        }}
      >
        Salaire
      </button>
      <output data-testid="settings-error">
        {p.command.error ||
          r.command.error ||
          r.form.formState.errors.root?.message}
      </output>
    </main>
  );
}
function Consumer() {
  const live = params.has("live");
  const query = useQuery({
    queryKey: ["identity"],
    queryFn: ({ signal }) => identityApi.getIdentity(signal),
    enabled: live,
  });
  const identity = live ? query.data : actor;
  if (!identity) return <p>Chargement identité</p>;
  return params.has("care") ? (
    <CareConsumer identity={identity} />
  ) : params.has("settings") ? (
    <SettingsConsumer identity={identity} />
  ) : (
    <BookingConsumer identity={identity} />
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <Consumer />
    </QueryClientProvider>
  </StrictMode>,
);
