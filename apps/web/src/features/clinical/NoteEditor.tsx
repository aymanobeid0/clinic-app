import type {
  Identity,
  VisitNote,
  ClinicalVersion,
  VisitNoteContent,
} from '@clinic/contracts';
import { useState } from 'react';
import { useNoteEditor } from './useNoteEditor.js';
import { noteMessages as t } from './note.messages.js';
export function NoteEditor({
  patientId,
  record,
  identity,
  cacheKey,
  onLock,
}: {
  patientId: string;
  record: VisitNote;
  identity: Identity;
  cacheKey: string[];
  onLock: (kind: string, value: boolean) => void;
}) {
  const editor = useNoteEditor(patientId, record, cacheKey, onLock);
  const [correcting, setCorrecting] = useState(false);
  const canDraft = identity.permissions.includes('notes.draft'),
    canFinalize =
      identity.kind === 'doctor' &&
      identity.permissions.includes('notes.finalize');
  const editable =
    canDraft &&
    (!record.current || !!record.draft || correcting || editor.dirty);
  return (
    <div className="note-editor">
      {record.current && (
        <NoteVersion
          version={record.current}
          correction={record.events.some(
            (v) =>
              v.status === 'final' && v.revision < record.current!.revision,
          )}
        />
      )}
      {!record.current && !record.draft && <p>{t.noDraft}</p>}
      {canDraft && record.current && !editable && (
        <button onClick={() => setCorrecting(true)}>{t.correction}</button>
      )}
      {editable ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void editor.save();
          }}
        >
          <label>
            {t.free}
            <textarea
              {...editor.form.register('text')}
              maxLength={30000}
              rows={8}
              aria-describedby={`note-memory-${record.visitId}`}
            />
          </label>
          <p id={`note-memory-${record.visitId}`} className="hint">
            {t.memory}
          </p>
          <p role="status">
            {editor.busy
              ? editor.saving
                ? t.saving
                : t.loadingComparison
              : editor.dirty
                ? t.unsaved
                : editor.revision === 0
                  ? t.noDraft
                  : t.saved}
          </p>
        </form>
      ) : record.draft ? (
        <NoteVersion version={record.draft} />
      ) : null}
      {editor.error && <p role="alert">{editor.error}</p>}
      {editor.uncertain && <p role="alert">{t.uncertain}</p>}
      {(editor.uncertain || (editor.error && !editor.conflict)) && (
        <button disabled={editor.busy} onClick={() => void editor.save()}>
          {editor.uncertain ? t.retry : t.retrySave}
        </button>
      )}
      {editor.conflict && (
        <div className="note-conflict" role="alert">
          <p>{t.conflict}</p>
          <button disabled={editor.busy} onClick={() => void editor.compare()}>
            {t.compare}
          </button>
          {editor.compared && (
            <>
              <h6>{t.server}</h6>
              <p className="note-text">
                {editor.compared.draft?.content.text ??
                  editor.compared.current?.content.text ??
                  t.noDraft}
              </p>
              <button onClick={() => editor.resolve(true)}>{t.mine}</button>
              <button onClick={() => editor.resolve(false)}>{t.theirs}</button>
            </>
          )}
        </div>
      )}
      {canFinalize && record.draft && (
        <button
          disabled={
            editor.dirty ||
            editor.busy ||
            editor.uncertain ||
            editor.conflict ||
            !record.draft.content.text.trim()
          }
          onClick={() => {
            if (confirm(t.confirmFinal)) {
              setCorrecting(false);
              void editor.save('finalize');
            }
          }}
        >
          {t.finalize}
        </button>
      )}
      {identity.permissions.includes('clinical.history') && (
        <details>
          <summary>{t.history}</summary>
          {record.events.map((v) => (
            <NoteVersion
              key={v.revision}
              version={v}
              correction={
                v.status === 'final' &&
                record.events.some(
                  (earlier) =>
                    earlier.status === 'final' && earlier.revision < v.revision,
                )
              }
            />
          ))}
        </details>
      )}
    </div>
  );
}
function NoteVersion({
  version,
  correction = false,
}: {
  version: ClinicalVersion<VisitNoteContent>;
  correction?: boolean;
}) {
  return (
    <article>
      <p>
        {version.status === 'draft'
          ? t.draft
          : correction
            ? t.correctionFinal
            : t.final}{' '}
        · {new Date(version.recordedAt).toLocaleString('fr')} ·{' '}
        {version.authorName}
        {version.finalizerName
          ? ` · ${t.finalization} : ${version.finalizerName}`
          : ''}{' '}
        · {t.version} {version.revision}
      </p>
      <p className="note-text">{version.content.text}</p>
    </article>
  );
}
