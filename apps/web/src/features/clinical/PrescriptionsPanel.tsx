import { useState } from "react";
import { useCareQuery } from "./useCareQuery.js";
import type { Identity, Prescription } from "@clinic/contracts";
import { HttpError } from "../identity/identity.api.js";
import { PrescriptionEditor } from "./PrescriptionEditor.js";
import { PrescriptionPrint, PrescriptionVersion } from "./PrescriptionPrint.js";
import { prescriptionMessages as t } from "./prescription.messages.js";
function PrescriptionList({
  patientId,
  identity,
  onLock,
}: {
  patientId: string;
  identity: Identity;
  onLock: (kind: string, value: boolean) => void;
}) {
  const key = [
    "prescriptions",
    identity.clinicId,
    identity.accountId,
    patientId,
  ];
  const [selected, setSelected] = useState(""),
    [newId, setNewId] = useState("");
  const query = useCareQuery<Prescription[]>(
    key,
    `clinical/${patientId}/prescriptions`,
  );

  const forbidden =
    query.error instanceof HttpError &&
    [401, 403, 404].includes(query.error.status);
  const record =
    query.data?.find((r) => r.id === selected) ??
    (newId
      ? { id: newId, revision: 0, current: null, draft: null, events: [] }
      : null);
  return (
    <section aria-label={t.title}>
      <h5>{t.title}</h5>
      {query.isPending && <p role="status">Chargement des ordonnances…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {!forbidden && (
        <>
          {query.data?.length === 0 && <p>Aucune ordonnance.</p>}
          <ul>
            {query.data?.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => {
                    if (
                      !record ||
                      confirm(
                        "Changer d’ordonnance ? Toute saisie non enregistrée sera perdue.",
                      )
                    ) {
                      setSelected(r.id);
                      setNewId("");
                    }
                  }}
                >
                  Ouvrir l’ordonnance {r.id.slice(0, 8)}
                </button>
              </li>
            ))}
          </ul>
          {identity.permissions.includes("prescriptions.draft") && (
            <button
              onClick={() => {
                if (
                  !record ||
                  confirm(
                    "Nouvelle ordonnance ? Toute saisie non enregistrée sera perdue.",
                  )
                ) {
                  const id = crypto.randomUUID();
                  setNewId(id);
                  setSelected(id);
                }
              }}
            >
              {t.new}
            </button>
          )}
          {record && (
            <div key={record.id}>
              {record.current && (
                <PrescriptionVersion version={record.current} />
              )}
              <PrescriptionEditor
                patientId={patientId}
                record={record}
                identity={identity}
                onLock={onLock}
                cacheKey={key}
              />
              {identity.permissions.includes("clinical.history") && (
                <details>
                  <summary>{t.history}</summary>
                  {record.events.map((v) => (
                    <div key={v.revision}>
                      <PrescriptionVersion
                        version={v}
                        superseded={
                          v.status === "final" &&
                          v.revision !== record.current?.revision
                        }
                      />
                      {v.status === "final" &&
                        identity.permissions.includes("clinical.print") && (
                          <PrescriptionPrint
                            patientId={patientId}
                            cacheKey={key}
                            id={record.id}
                            revision={v.revision}
                          />
                        )}
                    </div>
                  ))}
                </details>
              )}
              {record.current &&
                identity.permissions.includes("clinical.print") && (
                  <PrescriptionPrint
                    patientId={patientId}
                    cacheKey={key}
                    id={record.id}
                    revision={record.current.revision}
                  />
                )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function PrescriptionsPanel(
  props: Parameters<typeof PrescriptionList>[0],
) {
  const [initialized, setInitialized] = useState(false);
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open) setInitialized(true);
      }}
    >
      <summary>{t.title}</summary>
      {initialized && <PrescriptionList {...props} />}
    </details>
  );
}
