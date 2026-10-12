import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Field } from './Field.js';
type Props = {
  busy: boolean;
  loginEmail: string | null;
  token: string;
  onSend: (email: string) => Promise<void>;
  onVerify: (token: string) => Promise<void>;
};
export function EmailVerificationForm({ busy, token, loginEmail, onSend, onVerify }: Props) {
  const emailForm = useForm<{ email: string }>({
    defaultValues: { email: loginEmail ?? '' },
  });
  const tokenForm = useForm<{ token: string }>({ defaultValues: { token } });
  const { setValue } = tokenForm;
  useEffect(() => {
    if (token) setValue('token', token);
  }, [token, setValue]);
  return (
    <>
      <h2>Sécurisez votre accès</h2>
      <p className="description">
        Utilisez une adresse e-mail réelle à laquelle vous avez accès. Elle sera nécessaire pour
        récupérer votre compte responsable.
      </p>
      <form onSubmit={emailForm.handleSubmit(({ email }) => onSend(email))}>
        <Field label="Adresse e-mail de récupération">
          <input
            type="email"
            readOnly={Boolean(loginEmail)}
            autoComplete="email"
            {...emailForm.register('email')}
            required
          />
        </Field>
        <button disabled={busy}>Envoyer le lien de vérification</button>
      </form>
      <form
        className="verification"
        onSubmit={tokenForm.handleSubmit(({ token }) => onVerify(token))}
      >
        <Field label="Code de vérification reçu">
          <input autoComplete="off" {...tokenForm.register('token')} required maxLength={64} />
        </Field>
        <button className="secondary" disabled={busy}>
          Vérifier mon adresse
        </button>
      </form>
    </>
  );
}
