import { verifiedCurrencies, type TreatmentVersion } from '@clinic/contracts';
import { formatMinor } from './treatment.api.js';
import { planStatus, treatmentMessages as t } from './treatment.messages.js';
export function PlanVersionDetails({
  version: v,
}: {
  version: TreatmentVersion;
}) {
  const money = (value: string) =>
    `${formatMinor(value, verifiedCurrencies[v.currency])} ${v.currency}`;
  return (
    <section className="plan-version">
      <h2>{v.title}</h2>
      <p>
        Proposition {v.id} · version {v.revision} · {planStatus[v.status]}
      </p>
      <p>
        {v.authorName} · {new Date(v.recordedAt).toLocaleString('fr')}
      </p>
      <ul>
        {v.items.map((i) => (
          <li key={i.id}>
            {i.name} ·{' '}
            {i.scope === 'whole_mouth' ? t.whole : `FDI ${i.teeth.join(', ')}`}{' '}
            · prix {money(i.priceMinor)} · remise {money(i.discountMinor)}{' '}
            {i.discountReason && `· motif : ${i.discountReason}`}
            {!!i.extras?.length && (
              <ul>
                {i.extras.map((e) => (
                  <li key={e.id}>
                    Frais supplémentaires : {e.label} · {money(e.amountMinor)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p>Total proposé : {money(v.totalMinor)}</p>
      {v.notes && <p>Notes : {v.notes}</p>}
      {v.evidence && (
        <p>
          Accord : {v.evidence.acceptedBy} ·{' '}
          {new Date(v.evidence.acceptedAt).toLocaleString('fr')} ·{' '}
          {v.evidence.method} · proposition version{' '}
          {v.evidence.proposalRevision} · saisi par {v.evidence.recordedByName}{' '}
          le {new Date(v.evidence.recordedAt).toLocaleString('fr')}
        </p>
      )}
      {v.acceptance && (
        <p>
          Acceptation confirmée par {v.acceptance.confirmedByName} le{' '}
          {new Date(v.acceptance.confirmedAt).toLocaleString('fr')}
        </p>
      )}
      {v.cancellation && (
        <p>
          Annulation : {v.cancellation.reason} · {v.cancellation.actorName} ·{' '}
          {new Date(v.cancellation.at).toLocaleString('fr')}
        </p>
      )}
    </section>
  );
}
