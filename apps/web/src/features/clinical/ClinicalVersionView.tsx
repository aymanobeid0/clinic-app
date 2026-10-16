import type {
  ClinicalVersion,
  ClinicalContent,
  ChartContent,
} from '@clinic/contracts';
import { clinicalMessages as t } from './clinical.messages.js';
export function ClinicalVersionView({
  version,
}: {
  version: ClinicalVersion<ClinicalContent>;
}) {
  return (
    <article className="clinical-version">
      <p>
        <strong>{version.status === 'final' ? t.final : t.draft}</strong> ·{' '}
        {t.version(version.revision)}
      </p>
      <p>
        {t.observed} : {new Date(version.observedAt).toLocaleString('fr-FR')} ·{' '}
        {t.recorded} : {new Date(version.recordedAt).toLocaleString('fr-FR')}
      </p>
      <p>
        {t.author} : {version.authorName}
        {version.finalizerName &&
          ` · ${t.confirmation} : ${version.finalizerName}`}
      </p>
      {'medicalHistory' in version.content ? (
        <>
          <p>
            {t.historyLabel} : {version.content.medicalHistory || t.notEntered}
          </p>
          <p>
            {t.allergies} : {version.content.allergies || t.allergiesNotEntered}
          </p>
        </>
      ) : (
        <ChartView content={version.content} />
      )}
    </article>
  );
}
function ChartView({ content }: { content: ChartContent }) {
  return (
    <>
      <p>
        FDI · {t.dentition} {t.dentitions[content.dentition]}
      </p>
      {content.otherNotes && (
        <p>
          {t.otherNotes} : {content.otherNotes}
        </p>
      )}
      {content.teeth.length === 0 ? (
        <p>{t.noPositions}</p>
      ) : (
        <ul>
          {content.teeth.map((tooth) => (
            <li key={tooth.tooth}>
              <strong>{t.tooth(tooth.tooth)}</strong> :{' '}
              {t.presence[tooth.presence]}
              {tooth.extractionHistory ? ' · ' + t.extracted : ''}
              {tooth.treatments.map((v) => (
                <span key={v}> · {t.treatments[v]}</span>
              ))}
              <ul>
                {tooth.conditions.map((c, i) => (
                  <li key={i}>
                    {t.findings[c.finding]} ·{' '}
                    {c.surfaces.length
                      ? c.surfaces.map((s) => t.surfaces[s]).join(', ')
                      : t.wholeTooth}
                    {c.note && ` · ${c.note}`}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
