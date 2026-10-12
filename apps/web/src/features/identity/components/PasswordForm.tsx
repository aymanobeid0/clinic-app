import { useForm } from 'react-hook-form';
import { Field } from './Field.js';
type Props = { busy: boolean; onSubmit: (password: string) => Promise<void> };
export function PasswordForm({ busy, onSubmit }: Props) {
  const form = useForm<{ password: string }>();
  return (
    <>
      <h2>Votre mot de passe personnel</h2>
      <p className="description">Remplacez le mot de passe temporaire avant de continuer.</p>
      <form
        onSubmit={form.handleSubmit(async ({ password }) => {
          await onSubmit(password);
          form.reset();
        })}
      >
        <Field label="Nouveau mot de passe">
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            {...form.register('password')}
            required
          />
        </Field>
        <p className="hint">12 à 128 caractères. Choisissez un mot de passe différent.</p>
        <button disabled={busy}>Enregistrer le mot de passe</button>
      </form>
    </>
  );
}
