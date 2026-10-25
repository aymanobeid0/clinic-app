import { useCareQuery } from "./useCareQuery.js";
import { useCallback, useState } from "react";
import type { Identity, Visit, VisitNote } from "@clinic/contracts";
import { HttpError } from "../identity/identity.api.js";
import { NoteEditor } from "./NoteEditor.js";
import { noteMessages as t } from "./note.messages.js";
export function NotesPanel({
  patientId,
  identity,
  visits,
  onLock,
}: {
  patientId: string;
  identity: Identity;
  visits: Visit[];
  onLock: (kind: string, value: boolean) => void;
}) {
  const key = ["notes", identity.clinicId, identity.accountId, patientId];
  const [selected, setSelected] = useState(""),
    [locked, setLocked] = useState(false);
  const query = useCareQuery<VisitNote[]>(
    key,
    `clinical/${patientId}/notes`,
    `clinical/${patientId}/notes-events`,
  );
  const forbidden =
    query.error instanceof HttpError &&
    [401, 403, 404].includes(query.error.status);
  const lock = useCallback(
    (kind: string, value: boolean) => {
      setLocked(value);
      onLock(kind, value);
    },
    [onLock],
  );
  const record = query.data?.find((n) => n.visitId === selected);
  return (
    <section aria-label={t.title} className="visit-notes">
      <h5>{t.title}</h5>
      {query.isPending && <p role="status">{t.loading}</p>}
      {query.error && (
        <p role="alert">
          {query.error instanceof HttpError
            ? query.error.message
            : t.readUnavailable}
        </p>
      )}
      {!forbidden && (
        <>
          <ul>
            {visits.map((v) => (
              <li key={v.id}>
                <button
                  disabled={locked}
                  onClick={() => setSelected(v.id.toLowerCase())}
                >
                  {t.open(new Date(v.startedAt).toLocaleString("fr"))}
                </button>
                {query.data?.find((n) => n.visitId === v.id.toLowerCase())
                  ?.pending && <p className="note-pending">{t.pending}</p>}
              </li>
            ))}
          </ul>
          {record && (
            <NoteEditor
              key={selected}
              patientId={patientId}
              record={record}
              identity={identity}
              cacheKey={key}
              onLock={lock}
            />
          )}
        </>
      )}
    </section>
  );
}
