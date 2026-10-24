import { useAgenda } from './useAgenda.js';
import { useSchedulingSettings } from './useSchedulingSettings.js';
import type { Identity } from '@clinic/contracts';
import { statusLabels } from './scheduling.api.js';
import { AppointmentForm, SchedulingSettingsForm } from './AppointmentForm.js';
export function SchedulingPanel({ identity }: { identity: Identity }) {
  const permitted = identity.permissions.includes('appointments.manage');
  if (!permitted)
    return identity.isManager ? <ManagerSettings identity={identity} /> : null;
  return <Agenda identity={identity} />;
}
function Agenda({ identity }: { identity: Identity }) {
  const {
    changeStatus,
    retry,
    searchPatients,
    selectAppointment,
    scope,
    date,
    setDate,
    dentist,
    setDentist,
    search,
    setSearch,
    selected,
    reason,
    setReason,
    override,
    setOverride,
    notice,
    setDirty,
    formEpoch,
    settingsEpoch,
    pending,
    agenda,
    choices,
    displayedChoices,
    settings,
    history,
    mutation,
    submit,
    locked,
    error,
    reconcile,
    transitions,
  } = useAgenda(identity, window.confirm);
  return (
    <section className="scheduling-panel" aria-label="Agenda des rendez-vous">
      <h2>Agenda des rendez-vous</h2>
      <p>
        Réservations et arrivées · heure de Nouakchott (UTC). Une réservation ne
        donne aucun accès clinique.
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
            <select
              value={dentist}
              onChange={(e) => setDentist(e.target.value)}
            >
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
            Réponse incertaine. Votre demande est conservée. Réessayez la même
            demande pour éviter un doublon.
          </p>
          <button onClick={retry}>Réessayer la même demande</button>
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
        <p>
          Aucun rendez-vous ce jour. Choisissez un autre jour ou créez une
          réservation.
        </p>
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
                  {a.dentistName} · {a.chairId ?? 'Sans fauteuil'} ·{' '}
                  {statusLabels[a.status]}
                  {a.walkIn ? ' · Sans rendez-vous' : ''}
                </p>
              </div>
              <button
                className="secondary"
                disabled={locked}
                onClick={() => selectAppointment(a)}
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
            {selected.cancellationReason
              ? ` · Motif : ${selected.cancellationReason}`
              : ''}
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
                <button key={s} onClick={() => changeStatus(s)}>
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
                    {e.appointment.durationMinutes} min ·{' '}
                    {e.appointment.dentistName} ·{' '}
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
            onClick={() => selectAppointment(null)}
          >
            Fermer le détail
          </button>
        </div>
      )}
      <label>
        Rechercher un patient par nom ou numéro
        <input
          disabled={locked}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <button className="secondary" disabled={locked} onClick={searchPatients}>
        Rechercher dans les patients
      </button>
      <p className="hint">
        Les 50 premiers résultats sont affichés. Précisez le nom ou le numéro
        pour retrouver un autre patient.
      </p>
      {settings.data &&
        displayedChoices &&
        (!selected ||
          ['booked', 'confirmed', 'arrived'].includes(selected.status)) && (
          <AppointmentForm
            key={`${selected?.id ?? 'new'}:${selected?.revision ?? 'new'}:${formEpoch}`}
            scope={scope}
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
  const { epoch, settings, pending, mutation, submit, retry, reload } =
    useSchedulingSettings(identity);
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
          onSubmit={submit}
        />
      )}
      {pending && !mutation.isPending && (
        <button onClick={retry}>Réessayer la même demande</button>
      )}
      <button
        disabled={!!pending || mutation.isPending}
        onClick={() => void reload()}
      >
        Recharger les paramètres
      </button>
    </section>
  );
}
