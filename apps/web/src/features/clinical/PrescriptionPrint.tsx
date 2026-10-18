import { flushSync } from "react-dom";
import { useState } from "react";
import type { ClinicalVersion, PrescriptionContent } from "@clinic/contracts";
import { treatmentGet } from "../treatment/treatment.api.js";
import { prescriptionMessages as t } from "./prescription.messages.js";
export function PrescriptionVersion({
  version,
  superseded = false,
}: {
  version: ClinicalVersion<PrescriptionContent>;
  superseded?: boolean;
}) {
  const c = version.content;
  return (
    <article className="prescription-version">
      <h6>
        {superseded
          ? t.superseded
          : version.status === "final"
            ? t.issued
            : t.draft}{" "}
        · v{version.revision}
      </h6>
      {c.issued && (
        <>
          <p>{c.issued.header}</p>
          <p>{c.issued.clinicName}</p>
          <p>
            Patient {c.issued.patientNumber} · {c.issued.patientName}
          </p>
          <p>
            Prescripteur : {c.issued.prescriberName} ·{" "}
            {new Date(c.issued.issuedAt).toLocaleString("fr")}
          </p>
        </>
      )}
      <p>
        Auteur : {version.authorName} ·{" "}
        {new Date(version.recordedAt).toLocaleString("fr")}
        {version.finalizerName && ` · Signataire : ${version.finalizerName}`}
      </p>
      {c.replaces && (
        <p>
          Remplace la version {c.replaces} · {c.reason}
        </p>
      )}
      <ol>
        {c.medicines.map((m, i) => (
          <li key={i}>
            <strong>
              {m.name} · {m.strength} · {m.form}
            </strong>
            <p>
              {m.dose} · {m.route} · {m.frequency} · {m.duration}
              {m.quantity && ` · Quantité : ${m.quantity}`}
            </p>
            <p>{m.instructions}</p>
          </li>
        ))}
      </ol>
      <p>{c.instructions}</p>
      {c.issued && <p>{c.issued.footer}</p>}
    </article>
  );
}
export function PrescriptionPrint({
  patientId,
  id,
  revision,
}: {
  patientId: string;
  id: string;
  revision: number;
}) {
  const [error, setError] = useState(""),
    [value, setValue] = useState<{
      version: ClinicalVersion<PrescriptionContent>;
      superseded: boolean;
    } | null>(null);
  async function prepare() {
    try {
      const result = await treatmentGet<{
        version: ClinicalVersion<PrescriptionContent>;
        superseded: boolean;
      }>(`clinical/${patientId}/prescriptions/${id}/print/${revision}`);
      setValue(result);
      setError("");
    } catch (e) {
      setValue(null);
      setError(e instanceof Error ? e.message : "Impression indisponible.");
    }
  }
  async function print(target: HTMLElement) {
    try {
      const result = await treatmentGet<{
        version: ClinicalVersion<PrescriptionContent>;
        superseded: boolean;
      }>(`clinical/${patientId}/prescriptions/${id}/print/${revision}`);
      flushSync(() => setValue(result));
      target.classList.add("printing");
      document.body.classList.add("printing-prescription");
      try {
        window.print();
      } finally {
        target.classList.remove("printing");
        document.body.classList.remove("printing-prescription");
      }
    } catch (e) {
      setValue(null);
      setError(e instanceof Error ? e.message : "Impression indisponible.");
    }
  }
  return (
    <>
      <button type="button" onClick={() => void prepare()}>
        {t.print} {revision}
      </button>
      {error && <p role="alert">{error}</p>}
      {value && (
        <div className="prescription-print">
          <PrescriptionVersion {...value} />
          <button
            type="button"
            className="no-print"
            onClick={(e) => void print(e.currentTarget.parentElement!)}
          >
            Imprimer l’ordonnance affichée
          </button>
        </div>
      )}
    </>
  );
}
