import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, type SignIn } from '@clinic/contracts';
import type { z } from 'zod';
import { Field } from './Field.js';

type Props = {
  busy: boolean;
  unavailable: boolean;
  onSubmit: (input: SignIn) => Promise<void>;
  onInvalid: (message: string) => void;
};
export function SignInForm({ busy, unavailable, onSubmit, onInvalid }: Props) {
  const form = useForm<z.input<typeof signInSchema>, unknown, SignIn>({
    resolver: zodResolver(signInSchema),
    defaultValues: { method: 'email' },
    shouldUnregister: true,
  });
  const method = form.watch('method');
  return (
    <>
      <h2>Connexion à votre clinique</h2>
      <p className="description">
        Responsable principal : e-mail. Équipe et médecins responsables : identifiants de la
        clinique.
      </p>
      <label>
        Mode de connexion
        <select {...form.register('method')} disabled={busy}>
          <option value="email">Responsable principal — e-mail</option>
          <option value="clinic_username">Équipe / médecin responsable — identifiant</option>
        </select>
      </label>
      <form
        onSubmit={form.handleSubmit(
          async (input) => {
            await onSubmit(input);
            form.reset();
          },
          () => onInvalid('Vérifiez le code clinique, l’identifiant et le mot de passe.'),
        )}
      >
        {method === 'email' ? (
          <Field label="Adresse e-mail de connexion">
            <input type="email" autoComplete="username" {...form.register('email')} required />
          </Field>
        ) : (
          <>
            <Field label="Code de la clinique">
              <input
                autoComplete="organization"
                {...form.register('clinicCode')}
                required
                placeholder="ex. clinique-centre"
              />
            </Field>
            <Field label="Identifiant">
              <input autoComplete="username" {...form.register('username')} required />
            </Field>
          </>
        )}
        <Field label="Mot de passe">
          <input
            type="password"
            autoComplete="current-password"
            {...form.register('password')}
            required
          />
        </Field>
        <button disabled={busy || unavailable}>
          Se connecter <span aria-hidden="true">→</span>
        </button>
        <p className="hint">Votre responsable vous communique vos premiers identifiants.</p>
      </form>
    </>
  );
}
