import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Appointment,
  AppointmentStatus,
  Identity,
  SchedulingChoices,
} from '@clinic/contracts';
import { HttpError } from '../identity/identity.api.js';
import { schedulingApi, statusLabels } from './scheduling.api.js';
import { AppointmentForm, SchedulingSettingsForm } from './AppointmentForm.js';
export function SchedulingPanel({ identity }: { identity: Identity }) {
  const permitted = identity.permissions.includes('appointments.manage');
  if (!permitted) return identity.isManager ? <ManagerSettings identity={identity} /> : null;
  return <Agenda identity={identity} />;
}
function Agenda({ identity }: { identity: Identity }) {
  const client = useQueryClient();
  const scope = ['scheduling', identity.clinicId, identity.accountId];
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dentist, setDentist] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [lastChoices, setLastChoices] = useState<SchedulingChoices | undefined>();
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState(false);
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [formEpoch, setFormEpoch] = useState(0);
  const [settingsEpoch, setSettingsEpoch] = useState(0);
  const [pending, setPending] = useState<{ path: string; body: object } | null>(null);
  const agenda = useQuery({
    queryKey: [...scope, 'agenda', date, dentist],
    queryFn: ({ signal }) => schedulingApi.agenda(date, dentist, signal),
    retry: false,
    gcTime: 0,
    enabled: !!date,
  });
  const choices = useQuery({
    queryKey: [...scope, 'choices', appliedSearch],
    queryFn: ({ signal }) => schedulingApi.choices(appliedSearch, signal),
    retry: false,
    gcTime: 0,
  });
  useEffect(() => {
    if (choices.data) setLastChoices(choices.data);
  }, [choices.data]);
  const displayedChoices = choices.data ?? lastChoices;
  const settings = useQuery({
    queryKey: [...scope, 'settings'],
    queryFn: ({ signal }) => schedulingApi.settings(signal),
    retry: false,
    gcTime: 0,
  });
  const history = useQuery({
    queryKey: [...scope, 'history', selected?.id],
    queryFn: ({ signal }) => schedulingApi.history(selected!.id, signal),
    enabled: !!selected,
    retry: false,
    gcTime: 0,
  });
  useEffect(() => {
    const events = new EventSource('/api/appointments/events');
    const refresh = () =>
      void client.invalidateQueries({
        queryKey: ['scheduling', identity.clinicId, identity.accountId],
      });
    events.addEventListener('invalidate', refresh);
    events.onopen = refresh;
    events.onerror = () => {
      refresh();
      void client.invalidateQueries({ queryKey: ['identity'] });
    };
    return () => {
      events.close();
      void client.cancelQueries({
        queryKey: ['scheduling', identity.clinicId, identity.accountId],
      });
      client.removeQueries({
        queryKey: ['scheduling', identity.clinicId, identity.accountId],
      });
    };
  }, [client, identity.clinicId, identity.accountId]);
  const mutation = useMutation({
    mutationFn: (c: { path: string; body: object }) => schedulingApi.command(c.path, c.body),
    onSuccess: async (_result, command) => {
      await client.invalidateQueries({ queryKey: scope });
      setPending(null);
      setNotice('Modification enregistrée.');
      if (command.path === '/settings') setSettingsEpoch((v) => v + 1);
      else {
        setSelected(null);
        setFormEpoch((v) => v + 1);
      }
    },
    onError: (e) => {
      setNotice('');
      if (e instanceof HttpError && e.status < 500) setPending(null);
    },
  });
  function submit(path: string, body: object) {
    if (
      path.endsWith('/status') &&
      'status' in body &&
      body.status === 'cancelled' &&
      !window.confirm(
        'Confirmer l’annulation de ce rendez-vous ? Aucun frais automatique ne sera appliqué.',
      )
    )
      return;
    const command = { path, body: { ...body, commandId: crypto.randomUUID() } };
    setNotice('');
    setPending(command);
    mutation.mutate(command);
  }
  const locked = mutation.isPending || !!pending;
  const error =
    mutation.error ?? agenda.error ?? choices.error ?? settings.error ?? history.error;
  async function reconcile() {
    if (
      dirty &&
      !window.confirm('Recharger les donnees et remplacer votre saisie non enregistree ?')
    )
      return;
    const result = await agenda.refetch();
    if (result.isError) {
      setNotice('Rechargement impossible. Votre saisie est conservée.');
      return;
    }
    const freshSettings = await settings.refetch();
    if (freshSettings.isError) {
      setNotice('Rechargement impossible. Votre saisie est conservée.');
      return;
    }
    setFormEpoch((v) => v + 1);
    setSettingsEpoch((v) => v + 1);
    if (selected)
      setSelected(result.data?.appointments.find((a) => a.id === selected.id) ?? null);
    mutation.reset();
    setPending(null);
    setNotice('Données rechargées. Vérifiez votre saisie avant de réessayer.');
  }
  const transitions: Record<string, AppointmentStatus[]> = {
    booked: ['confirmed', 'arrived', 'cancelled', 'no_show'],
    confirmed: ['booked', 'arrived', 'cancelled', 'no_show'],
    arrived: ['confirmed', 'cancelled'],
    cancelled: ['booked'],
    no_show: ['booked'],
  };
  return (
    <section className="scheduling-panel" aria-label="Agenda des rendez-vous">
      <h2>Agenda des rendez-vous</h2>
      <p>
        Réservations et arrivées · heure de Nouakchott (UTC). Une réservation ne donne aucun
        accès clinique.
      </p>
      <fieldset disabled={locked}>
        <legend>Afficher l’agenda</legend>
        <div className="scheduling-grid">
          <label>
            Jour
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Filtrer par dentiste
            <select value={dentist} onChange={(e) => setDentist(e.target.value)}>
              <option value="">Tous les dentistes</option>
              {choices.data?.dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      {error && <p role="alert">{error.message}</p>}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {mutation.isPending && <p role="status">Enregistrement en cours…</p>}
      {pending && !mutation.isPending && (
        <>
          <p role="alert">
            Réponse incertaine. Votre demande est conservée. Réessayez la même demande pour
            éviter un doublon.
          </p>
          <button onClick={() => mutation.mutate(pending)}>Réessayer la même demande</button>
        </>
      )}
      {!locked && (
        <button className="secondary" onClick={() => void reconcile()}>
          Recharger et réconcilier
        </button>
      )}
      {agenda.isPending ? (
        <p role="status">Chargement de l’agenda…</p>
      ) : agenda.data?.appointments.length === 0 ? (
        <p>Aucun rendez-vous ce jour. Choisissez un autre jour ou créez une réservation.</p>
      ) : (
        <ul className="appointment-list">
          {agenda.data?.appointments.map((a) => (
            <li key={a.id}>
              <div>
                <strong>
                  {new Intl.DateTimeFormat('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Africa/Nouakchott',
                  }).format(new Date(a.startsAt))}{' '}
                  · {a.durationMinutes} min
                </strong>
                <p>
                  n°{a.patientNumber} · {a.patientName}
                </p>
                <p>
                  {a.dentistName} · {a.chairId ?? 'Sans fauteuil'} · {statusLabels[a.status]}
                  {a.walkIn ? ' · Sans rendez-vous' : ''}
                </p>
              </div>
              <button
                className="secondary"
                disabled={locked}
                onClick={() => {
                  if (dirty && !window.confirm('Quitter cette saisie non enregistree ?'))
                    return;
                  setDirty(false);
                  setSelected(a);
                  setReason('');
                  setOverride(false);
                  mutation.reset();
                }}
              >
                Gérer le rendez-vous de {a.patientName}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className="appointment-detail">
          <h3>Rendez-vous de {selected.patientName}</h3>
          <p>
            État : {statusLabels[selected.status]}
            {selected.cancellationReason ? ` · Motif : ${selected.cancellationReason}` : ''}
          </p>
          <fieldset disabled={locked}>
            <legend>Changer l’état</legend>
            <label>
              Motif d’annulation (facultatif)
              <input
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {identity.permissions.includes('appointments.override') && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => setOverride(e.target.checked)}
                />
                Confirmer une dérogation en cas de chevauchement
              </label>
            )}
            <div className="appointment-actions">
              {transitions[selected.status]?.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    submit(`/${selected.id}/status`, {
                      revision: selected.revision,
                      status: s,
                      reason,
                      override,
                    })
                  }
                >
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="hint">
            Le début et la fin des soins seront reliés aux visites cliniques.
          </p>
          <details>
            <summary>Historique du rendez-vous</summary>
            {history.isPending ? (
              <p>Chargement…</p>
            ) : (
              <ol>
                {history.data?.map((e, i) => (
                  <li key={i}>
                    {new Date(e.at).toLocaleString('fr-FR', {
                      timeZone: 'Africa/Nouakchott',
                    })}{' '}
                    · {e.actorName} ·{' '}
                    {e.action === 'rescheduled'
                      ? 'Déplacement'
                      : e.action === 'walk_in'
                        ? 'Arrivée sans rendez-vous'
                        : e.action === 'booked'
                          ? 'Réservation'
                          : 'Changement d’état'}{' '}
                    · {statusLabels[e.appointment.status]} ·{' '}
                    {e.appointment.startsAt.slice(0, 16).replace('T', ' ')} ·{' '}
                    {e.appointment.durationMinutes} min · {e.appointment.dentistName} ·{' '}
                    {e.appointment.chairId ?? 'Sans fauteuil'}
                    {e.override ? ' · Dérogation explicite' : ''}
                    {e.appointment.cancellationReason
                      ? ` · ${e.appointment.cancellationReason}`
                      : ''}
                  </li>
                ))}
              </ol>
            )}
          </details>
          <button
            disabled={locked}
            className="secondary"
            onClick={() => {
              if (dirty && !window.confirm('Quitter cette saisie non enregistree ?')) return;
              setDirty(false);
              setSelected(null);
            }}
          >
            Fermer le détail
          </button>
        </div>
      )}
      <label>
        Rechercher un patient par nom ou numéro
        <input disabled={locked} value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <button
        className="secondary"
        disabled={locked}
        onClick={() => {
          setAppliedSearch(search);
          if (search === appliedSearch) void choices.refetch();
        }}
      >
        Rechercher dans les patients
      </button>
      <p className="hint">
        Les 50 premiers résultats sont affichés. Précisez le nom ou le numéro pour retrouver un
        autre patient.
      </p>
      {settings.data &&
        displayedChoices &&
        (!selected || ['booked', 'confirmed', 'arrived'].includes(selected.status)) && (
          <AppointmentForm
            key={`${selected?.id ?? 'new'}:${selected?.revision ?? 'new'}:${formEpoch}`}
            appointment={selected}
            choices={displayedChoices}
            settings={settings.data}
            busy={locked}
            canOverride={identity.permissions.includes('appointments.override')}
            onDirty={setDirty}
            onSubmit={submit}
          />
        )}
      {settings.data && identity.isManager && (
        <SchedulingSettingsForm
          key={`settings:${settingsEpoch}`}
          settings={settings.data}
          busy={locked}
          onSubmit={submit}
        />
      )}
    </section>
  );
}
function ManagerSettings({ identity }: { identity: Identity }) {
  const [epoch, setEpoch] = useState(0);
  const client = useQueryClient();
  const key = ['scheduling', identity.clinicId, identity.accountId, 'settings'];
  const settings = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => schedulingApi.settings(signal),
    retry: false,
    gcTime: 0,
  });
  const [pending, setPending] = useState<{ path: string; body: object } | null>(null);
  const mutation = useMutation({
    mutationFn: (c: { path: string; body: object }) => schedulingApi.command(c.path, c.body),
    onSuccess: () => {
      setPending(null);
      void client.invalidateQueries({ queryKey: key }).then(() => setEpoch((v) => v + 1));
    },
    onError: (e) => {
      if (e instanceof HttpError && e.status < 500) setPending(null);
    },
  });
  useEffect(
    () => () => {
      void client.cancelQueries({
        queryKey: ['scheduling', identity.clinicId, identity.accountId],
      });
      client.removeQueries({
        queryKey: ['scheduling', identity.clinicId, identity.accountId],
      });
    },
    [client, identity.clinicId, identity.accountId],
  );
  return (
    <section className="scheduling-panel" aria-label="Paramètres de l’agenda">
      <h2>Paramètres de l’agenda</h2>
      {(settings.error || mutation.error) && (
        <p role="alert">{(settings.error ?? mutation.error)?.message}</p>
      )}
      {mutation.isSuccess && <p role="status">Paramètres enregistrés.</p>}
      {settings.data && (
        <SchedulingSettingsForm
          key={epoch}
          settings={settings.data}
          busy={!!pending || mutation.isPending}
          onSubmit={(path, body) => {
            const c = {
              path,
              body: { ...body, commandId: crypto.randomUUID() },
            };
            setPending(c);
            mutation.mutate(c);
          }}
        />
      )}
      {pending && !mutation.isPending && (
        <button onClick={() => mutation.mutate(pending)}>Réessayer la même demande</button>
      )}
      <button
        disabled={!!pending || mutation.isPending}
        onClick={() => {
          mutation.reset();
          void settings.refetch().then((result) => {
            if (!result.isError) setEpoch((v) => v + 1);
          });
        }}
      >
        Recharger les paramètres
      </button>
    </section>
  );
}
