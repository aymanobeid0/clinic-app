import { useLayoutEffect, useRef, useState } from "react";
import { usePrescriptionPrint } from "./usePrescriptionPrint.js";
import type { ClinicalVersion, PrescriptionContent } from "@clinic/contracts";
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
  cacheKey,
}: {
  patientId: string;
  id: string;
  revision: number;
  cacheKey: readonly string[];
}) {
  const reader = usePrescriptionPrint(patientId, id, revision, cacheKey);
  const { data: value, error, prepare } = reader;
  const target = useRef<HTMLDivElement>(null);
  const [printRequested, setPrintRequested] = useState(false);
  async function print() {
    const result = await reader.authorize();
    if (result) setPrintRequested(true);
  }
  useLayoutEffect(() => {
    if (!printRequested || !value || !target.current) return;
    const element = target.current;
    element.classList.add("printing");
    document.body.classList.add("printing-prescription");
    try {
      window.print();
    } finally {
      element.classList.remove("printing");
      document.body.classList.remove("printing-prescription");
      setPrintRequested(false);
    }
  }, [printRequested, value]);
  return (
    <>
      <button type="button" onClick={() => void prepare()}>
        {t.print} {revision}
      </button>
      {error && <p role="alert">{error}</p>}
      {value && (
        <div ref={target} className="prescription-print">
          <PrescriptionVersion {...value} />
          <button
            type="button"
            className="no-print"
            onClick={() => void print()}
          >
            Imprimer l’ordonnance affichée
          </button>
        </div>
      )}
    </>
  );
}
