import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  verifiedCurrencies,
  type CatalogEntry,
  type Identity,
} from '@clinic/contracts';
import { treatmentApi, treatmentGet, formatMinor } from './treatment.api.js';
import { useTreatmentCommand, CommandState } from './useTreatmentCommand.js';
import { treatmentMessages as t } from './treatment.messages.js';
export function CatalogPanel({ identity }: { identity: Identity }) {
  const [currenciesOpen, setCurrenciesOpen] = useState(false);
  const allowed = identity.permissions.includes('catalog.manage');
  if (!allowed && !identity.isManager) return null;
  return (
    <section className="treatment" aria-label={t.catalog}>
      <h3>{t.catalog}</h3>
      <p>{t.catalogHelp}</p>
      {identity.isManager && (
        <details onToggle={(e) => setCurrenciesOpen(e.currentTarget.open)}>
          <summary>Devises de la clinique</summary>
          {currenciesOpen && <CurrencyForm identity={identity} />}
        </details>
      )}
      {allowed && <CatalogEditor identity={identity} />}
    </section>
  );
}
function CurrencyForm({ identity }: { identity: Identity }) {
  const cache = useQueryClient();
  useEffect(() => {
    const stream = new EventSource('/api/catalog/currencies/events');
    const refresh = () => {
      void cache.invalidateQueries({
        queryKey: ['currencies', identity.clinicId, identity.accountId],
      });
    };
    stream.addEventListener('invalidate', refresh);
    stream.onopen = refresh;
    stream.onerror = () => {
      refresh();
      void cache.invalidateQueries({ queryKey: ['identity'] });
    };
    return () => stream.close();
  }, [cache, identity.clinicId, identity.accountId]);
  const f = useForm({ defaultValues: { code: 'MRU' } });
  const query = useQuery({
    queryKey: ['currencies', identity.clinicId, identity.accountId],
    queryFn: () => treatmentGet<{ code: string }[]>('catalog/currencies'),
    gcTime: 0,
  });
  const command = useTreatmentCommand(
    ['currencies', identity.clinicId, identity.accountId],
    undefined,
    undefined,
    'Devise activée',
  );
  return (
    <form
      onSubmit={f.handleSubmit((v) => {
        void command.save('catalog/currencies', v);
      })}
    >
      <fieldset disabled={command.busy || command.uncertain}>
        <legend>Devises de la clinique</legend>
        <p>{t.currencyHelp}</p>
        {query.data && (
          <p>
            Devises actives :{' '}
            {query.data.map((c) => c.code).join(', ') || 'aucune'}
          </p>
        )}
        {query.error && <p role="alert">{query.error.message}</p>}
        <label>
          {t.currencyToEnable}
          <select aria-label={t.currencyToEnable} {...f.register('code')}>
            {Object.entries(verifiedCurrencies).map(([c, p]) => (
              <option key={c} value={c}>
                {c} · {p} décimales
              </option>
            ))}
          </select>
        </label>
        <button>{t.enable}</button>
      </fieldset>
      <CommandState state={command} />
    </form>
  );
}
function CatalogEditor({ identity }: { identity: Identity }) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['catalog', identity.clinicId, identity.accountId],
    queryFn: ({ signal }) => treatmentApi.catalog(signal),
    gcTime: 0,
    retry: false,
  });
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const stream = new EventSource('/api/catalog/events');
    const refresh = () => {
      void cache.invalidateQueries({
        queryKey: ['catalog', identity.clinicId, identity.accountId],
      });
      void cache.invalidateQueries({
        queryKey: ['currencies', identity.clinicId, identity.accountId],
      });
      void cache.invalidateQueries({ queryKey: ['identity'] });
    };
    stream.addEventListener('invalidate', refresh);
    stream.onopen = refresh;
    stream.onerror = refresh;
    return () => stream.close();
  }, [cache, identity.clinicId, identity.accountId]);
  if (query.error) return <p role="alert">{query.error.message}</p>;
  if (!query.data) return <p role="status">{t.loading}</p>;
  return (
    <>
      <ul>
        {query.data.entries.map((e) => (
          <li key={e.id}>
            <button
              disabled={locked}
              onClick={() => {
                if (confirm(t.patientSwitch)) {
                  setSelected(e);
                  setEpoch((x) => x + 1);
                }
              }}
            >
              {e.name} ·{' '}
              {formatMinor(e.priceMinor, verifiedCurrencies[e.currency])}{' '}
              {e.currency} · {e.durationMinutes} min ·{' '}
              {e.active ? 'Disponible' : 'Retiré'}
            </button>
          </li>
        ))}
      </ul>
      <button
        disabled={locked}
        onClick={() => {
          if (confirm(t.patientSwitch)) {
            setSelected(null);
            setEpoch((x) => x + 1);
          }
        }}
      >
        {t.newEntry}
      </button>
      <CatalogForm
        key={epoch}
        entry={selected}
        currencies={query.data.currencies}
        onLock={setLocked}
      />
    </>
  );
}
function CatalogForm({
  entry,
  currencies,
  onLock,
}: {
  entry: CatalogEntry | null;
  currencies: CatalogEntry['currency'][];
  onLock: (v: boolean) => void;
}) {
  const [id] = useState(() => entry?.id ?? crypto.randomUUID());
  const [revision, setRevision] = useState(entry?.revision ?? 0);
  const [reloadError, setReloadError] = useState('');
  const [remote, setRemote] = useState<CatalogEntry>();
  const f = useForm({
    defaultValues: {
      name: entry?.name ?? '',
      chartCategory: entry?.chartCategory ?? 'manual',
      currency: entry?.currency ?? currencies[0] ?? 'MRU',
      price: entry
        ? formatMinor(entry.priceMinor, verifiedCurrencies[entry.currency])
        : '',
      durationMinutes: entry?.durationMinutes ?? 30,
      active: entry?.active ?? true,
    },
  });
  const command = useTreatmentCommand<CatalogEntry>(
    ['catalog'],
    (v) => {
      setRevision(v.revision);
      f.reset(f.getValues());
    },
    undefined,
    t.catalogSaved,
  );
  useEffect(() => {
    onLock(command.busy || command.uncertain);
    return () => onLock(false);
  }, [onLock, command.busy, command.uncertain]);
  return (
    <form
      onSubmit={f.handleSubmit((v) => {
        void command.save('catalog', {
          ...v,
          id,
          revision,
          durationMinutes: Number(v.durationMinutes),
        });
      })}
    >
      <fieldset disabled={command.busy || command.uncertain}>
        <legend>{entry ? `Modifier ${entry.name}` : t.newEntry}</legend>
        <label>
          {t.name}
          <input required maxLength={160} {...f.register('name')} />
        </label>
        <label>
          {t.currency}
          <select disabled={!!entry} {...f.register('currency')}>
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          {t.price}
          <input required inputMode="decimal" {...f.register('price')} />
        </label>
        <label>
          {t.duration}
          <input
            required
            type="number"
            min={5}
            max={480}
            {...f.register('durationMinutes')}
          />
        </label>
        <label>Catégorie explicite pour le schéma
          <select {...f.register('chartCategory')}><option value="manual">Sans suggestion — manuel</option><option value="extraction">Extraction</option><option value="restoration">Restauration</option><option value="crown">Couronne</option><option value="root_canal">Traitement canalaire</option><option value="implant">Implant</option></select>
        </label>
        <label className="check">
          <input type="checkbox" {...f.register('active')} />
          {t.active}
        </label>
        <button disabled={!currencies.length}>Enregistrer l’acte</button>
      </fieldset>
      <CommandState state={command} />
      {remote && (
        <p>
          Version distante {remote.revision} : {remote.name} ·{' '}
          {formatMinor(remote.priceMinor, verifiedCurrencies[remote.currency])}{' '}
          {remote.currency} · {remote.durationMinutes} min ·{' '}
          {remote.active ? 'Disponible' : 'Retiré'}. Votre saisie est conservée.
        </p>
      )}
      {reloadError && <p role="alert">{reloadError}</p>}
      {command.error && !command.uncertain && (
        <button
          type="button"
          onClick={() => {
            void treatmentApi
              .catalog()
              .then((c) => {
                const remote = c.entries.find((e) => e.id === id);
                setRemote(remote);
                setRevision(remote?.revision ?? 0);
                setReloadError('');
              })
              .catch((e) =>
                setReloadError(
                  e instanceof Error ? e.message : 'Relecture indisponible.',
                ),
              );
          }}
        >
          Relire le catalogue puis vérifier votre saisie
        </button>
      )}
    </form>
  );
}
