import { useEffect, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  Appointment,
  AppointmentStatus,
  Identity,
} from '@clinic/contracts';
import { HttpError } from '../identity/identity.api.js';
import { schedulingApi } from './scheduling.api.js';

import { createIdentityWorkflow } from '../identity/identity.workflow.js';
export function useAgenda(
  identity: Identity,
  confirmAction: (message: string) => boolean,
) {
  const client = useQueryClient();
  const scope = ['scheduling', identity.clinicId, identity.accountId];
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dentist, setDentist] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState(false);
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [formEpoch, setFormEpoch] = useState(0);
  const [settingsEpoch, setSettingsEpoch] = useState(0);
  const [pending, setPending] = useState<{ path: string; body: object } | null>(
    null,
  );
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
    placeholderData: keepPreviousData,
  });
  const displayedChoices = choices.data;
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
    mutationFn: (c: { path: string; body: object }) =>
      schedulingApi.command(c.path, c.body),
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
    onError: async (e) => {
      await createIdentityWorkflow(client).reconcileDenied(e);
      setNotice('');
      if (e instanceof HttpError && e.status < 500) setPending(null);
    },
  });
  function submit(path: string, body: object) {
    if (
      path.endsWith('/status') &&
      'status' in body &&
      body.status === 'cancelled' &&
      !confirmAction(
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
    mutation.error ??
    agenda.error ??
    choices.error ??
    settings.error ??
    history.error;
  async function reconcile() {
    if (
      dirty &&
      !confirmAction(
        'Recharger les donnees et remplacer votre saisie non enregistree ?',
      )
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
      setSelected(
        result.data?.appointments.find((a) => a.id === selected.id) ?? null,
      );
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
  function retry() {
    if (pending && !mutation.isPending) mutation.mutate(pending);
  }
  function searchPatients() {
    setAppliedSearch(search);
    if (search === appliedSearch) void choices.refetch();
  }
  function selectAppointment(appointment: Appointment | null) {
    if (dirty && !confirmAction('Quitter cette saisie non enregistree ?'))
      return;
    setDirty(false);
    setSelected(appointment);
    setReason('');
    setOverride(false);
    mutation.reset();
  }
  function changeStatus(status: AppointmentStatus) {
    if (!selected || locked) return;
    submit(`/${selected.id}/status`, {
      revision: selected.revision,
      status,
      reason,
      override,
    });
  }
  return {
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
    appliedSearch,
    setAppliedSearch,
    selected,
    setSelected,
    reason,
    setReason,
    override,
    setOverride,
    notice,
    dirty,
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
  };
}
