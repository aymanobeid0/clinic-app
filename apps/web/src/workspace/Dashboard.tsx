import { useState, type ReactNode } from "react";
import type { Identity, FinancialReportTotal } from "@clinic/contracts";
import { useReport } from "../features/reporting/useReport.js";
import { reportAllowed } from "../features/reporting/reporting.access.js";
type ReadState = {
  isPending: boolean;
  denied: boolean;
  error: Error | null;
  refetch: () => unknown;
};
function ReportSection({
  title,
  read,
  children,
}: {
  title: string;
  read: ReadState;
  children: ReactNode;
}) {
  return (
    <section className="surface">
      <div className="section-heading">
        <h2>{title}</h2>
        <button
          className="quiet"
          onClick={() => {
            void read.refetch();
          }}
        >
          Actualiser<span className="sr-only"> {title}</span>
        </button>
      </div>
      {read.denied ? (
        <p role="alert">Vous n’avez plus accès à ces informations.</p>
      ) : read.error ? (
        <div role="alert">
          <p>{read.error.message}</p>
          <p>
            Informations indisponibles. Réessayez sans supposer de solde nul.
          </p>
        </div>
      ) : read.isPending ? (
        <p role="status">Chargement des informations…</p>
      ) : (
        children
      )}
    </section>
  );
}
const statuses = {
  booked: "Réservé",
  confirmed: "Confirmé",
  arrived: "Arrivé",
  in_care: "En soins",
  completed: "Terminé",
  cancelled: "Annulé",
  no_show: "Absent",
};
function Appointments({
  identity,
  date,
}: {
  identity: Identity;
  date: string;
}) {
  const read = useReport(identity, "appointments", date);
  return (
    <ReportSection title="Rendez-vous du jour" read={read}>
      {read.data &&
        (read.data.appointments.length ? (
          <ul className="appointments">
            {read.data.appointments.map((a) => (
              <li key={a.id}>
                <time dateTime={a.startsAt}>
                  {new Date(a.startsAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })}
                  <small>UTC · {a.durationMinutes} min</small>
                </time>
                <div>
                  <strong>{a.patientName}</strong>
                  <p>{a.dentistName}</p>
                </div>
                <span className="badge">{statuses[a.status]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Aucun rendez-vous pour cette journée.</p>
        ))}
    </ReportSection>
  );
}
function money(value: string, currency: string) {
  const precision =
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  const amount = BigInt(value);
  const absolute = (amount < 0n ? -amount : amount)
    .toString()
    .padStart(precision + 1, "0");
  return `${amount < 0n ? "−" : ""}${precision ? absolute.slice(0, -precision) + "," + absolute.slice(-precision) : absolute} ${currency}`;
}
const columns: [keyof FinancialReportTotal, string][] = [
  ["invoiceMinor", "Factures émises"],
  ["newMoneyMinor", "Nouveaux encaissements"],
  ["appliedCreditMinor", "Crédit déjà reçu appliqué"],
  ["dueMinor", "Solde dû"],
  ["creditMinor", "Crédit disponible"],
  ["openingMinor", "Soldes initiaux"],
  ["adjustmentMinor", "Ajustements"],
  ["refundMinor", "Remboursements"],
  ["reversedMoneyMinor", "Encaissements annulés"],
  ["plannedMinor", "Soins futurs, hors dette"],
];
function Finances({ identity, date }: { identity: Identity; date: string }) {
  const read = useReport(identity, "financial", date);
  return (
    <ReportSection title="Situation financière" read={read}>
      {read.data && (
        <>
          <p className="hint">
            Encaissements du {read.data.date} · soldes au{" "}
            {new Date(read.data.balanceAsOf).toLocaleString("fr-FR", {
              timeZone: "UTC",
            })}{" "}
            UTC. Montants limités à vos droits.
          </p>
          {read.data.totals.length ? (
            read.data.totals.map((total) => (
              <div key={total.currency} className="currency-summary">
                <h3>{total.currency}</h3>
                <dl className="metrics">
                  {columns.map(([key, title]) => (
                    <div key={key}>
                      <dt>{title}</dt>
                      <dd>{money(total[key], total.currency)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))
          ) : (
            <p className="empty">
              Aucune activité financière autorisée pour cette date.
            </p>
          )}
        </>
      )}
    </ReportSection>
  );
}
function Tasks({ identity }: { identity: Identity }) {
  const read = useReport(identity, "tasks");
  return (
    <ReportSection title="Suivis à prévoir" read={read}>
      {read.data && (
        <>
          <p className="hint">
            Les actions de suivi et les notes se traitent dans leurs espaces
            dédiés lorsqu’ils sont disponibles.
          </p>
          <ul className="task-list">
            {read.data.tasks
              .filter((t) => t.status === "open")
              .map((t) => (
                <li key={t.id}>
                  <strong>Patient {t.patientId}</strong>
                  <span>À contacter · échéance {t.dueOn}</span>
                </li>
              ))}
            {read.data.pendingNotes.map((t) => (
              <li key={t.id}>
                <strong>Note en attente</strong>
                <span>Patient {t.patientId}</span>
              </li>
            ))}
          </ul>
          {!read.data.tasks.some((t) => t.status === "open") &&
            !read.data.pendingNotes.length && (
              <p className="empty">Aucun suivi en attente.</p>
            )}
        </>
      )}
    </ReportSection>
  );
}
function Stock({ identity }: { identity: Identity }) {
  const read = useReport(identity, "stock");
  return (
    <ReportSection title="Vigilance stock" read={read}>
      {read.data && (
        <dl className="metrics">
          <div>
            <dt>Articles sous le seuil</dt>
            <dd>{read.data.lowStock.length}</dd>
          </div>
          <div>
            <dt>Lots proches de péremption</dt>
            <dd>{read.data.expiring.length}</dd>
          </div>
          <div>
            <dt>Lots périmés</dt>
            <dd>{read.data.expired.length}</dd>
          </div>
        </dl>
      )}
    </ReportSection>
  );
}
export function Dashboard({ identity }: { identity: Identity }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const operational = reportAllowed(identity, "appointments");
  return (
    <>
      <p className="eyebrow">VOTRE JOURNÉE, EN UN REGARD</p>
      <div className="page-heading">
        <div>
          <h1>Bonjour, {identity.displayName}</h1>
          <p className="description">
            Les informations utiles à votre rôle, au même endroit.
          </p>
        </div>
        <label>
          Journée (UTC)
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      {!date ? (
        <p role="alert">
          Choisissez une date valide pour afficher votre journée.
        </p>
      ) : (
        <>
          {operational && <Appointments identity={identity} date={date} />}
          {reportAllowed(identity, "financial") && (
            <Finances identity={identity} date={date} />
          )}
        </>
      )}
      <div className="dashboard-secondary">
        {operational && <Tasks identity={identity} />}
        {reportAllowed(identity, "stock") && <Stock identity={identity} />}
      </div>
      {!operational && !reportAllowed(identity, "financial") && (
        <section className="surface">
          <h2>Votre accès est prêt</h2>
          <p>
            Aucune vue opérationnelle n’est autorisée pour votre compte.
            Contactez votre responsable pour vos droits d’accès.
          </p>
        </section>
      )}
    </>
  );
}
