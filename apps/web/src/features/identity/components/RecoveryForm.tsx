import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { post, refreshSession } from '../identity.api.js';
import { Field } from './Field.js';
export function RecoveryForm() {
  const form = useForm<{
    method: 'email' | 'clinic_username';
    email: string;
    clinicCode: string;
    username: string;
    code: string;
    token: string;
    password: string;
  }>({
    defaultValues: {
      method: 'email',
      token: new URLSearchParams(location.hash.slice(1)).get('recovery') ?? '',
    },
  });
  useEffect(() => {
    const capture = () => {
      const value = new URLSearchParams(location.hash.slice(1)).get('recovery');
      if (value) {
        form.setValue('token', value);
        history.replaceState(null, '', location.pathname + location.search);
      }
    };
    capture();
    window.addEventListener('hashchange', capture);
    return () => window.removeEventListener('hashchange', capture);
  }, [form]);
  const [route, setRoute] = useState('code');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  const method = form.watch('method');
  return (
    <details>
      <summary>Récupérer mon compte responsable</summary>
      <form
        onSubmit={form.handleSubmit(async (d) => {
          setBusy(true);
          setError('');
          setNotice('');
          const identity =
            d.method === 'email'
              ? { method: d.method, email: d.email }
              : {
                  method: d.method,
                  clinicCode: d.clinicCode,
                  username: d.username,
                };
          try {
            await refreshSession();
            await post(`recovery/${route}`, {
              identity,
              ...(route === 'code'
                ? { code: d.code, password: d.password }
                : route === 'email'
                  ? { token: d.token, password: d.password }
                  : {}),
            });
            form.reset();
            if (route === 'request')
              setNotice('Si le compte est éligible, un lien de récupération a été envoyé.');
            else {
              history.replaceState(null, '', location.pathname + location.search);
              cache.removeQueries({ predicate: (query) => query.queryKey[0] !== 'identity' });
              await cache.invalidateQueries({ queryKey: ['identity'] });
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Service indisponible.');
          } finally {
            setBusy(false);
          }
        })}
      >
        <p>
          Pour l’équipe, demandez une réinitialisation à votre responsable. Les codes ne réactivent
          pas un compte désactivé.
        </p>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <Field label="Identité à récupérer">
          <select {...form.register('method')}>
            <option value="email">Responsable principal — e-mail</option>
            <option value="clinic_username">Responsable — identifiant clinique</option>
          </select>
        </Field>
        {method === 'email' ? (
          <Field label="Adresse e-mail du compte">
            <input type="email" {...form.register('email')} required />
          </Field>
        ) : (
          <>
            <Field label="Code clinique du compte">
              <input {...form.register('clinicCode')} required />
            </Field>
            <Field label="Identifiant du compte">
              <input {...form.register('username')} required />
            </Field>
          </>
        )}
        <Field label="Méthode de récupération">
          <select value={route} onChange={(e) => setRoute(e.target.value)}>
            <option value="code">Code hors ligne</option>
            <option value="request">Recevoir un lien par e-mail</option>
            <option value="email">Utiliser un lien reçu</option>
          </select>
        </Field>
        {route === 'code' && (
          <Field label="Code de récupération">
            <input {...form.register('code')} required autoComplete="off" />
          </Field>
        )}
        {route === 'email' && (
          <Field label="Jeton du lien de récupération">
            <input {...form.register('token')} required autoComplete="off" />
          </Field>
        )}
        {route !== 'request' && (
          <Field label="Nouveau mot de passe de récupération">
            <input
              type="password"
              {...form.register('password')}
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </Field>
        )}
        <button disabled={busy}>
          {route === 'request' ? 'Envoyer le lien' : 'Récupérer et vérifier mes coordonnées'}
        </button>
      </form>
    </details>
  );
}
