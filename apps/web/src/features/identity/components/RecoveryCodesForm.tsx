import { ValidatedForm } from "../../../forms/ValidatedForm.js";
import { useForm } from 'react-hook-form';
import type { RecoveryCodes } from '@clinic/contracts';
import { Field } from './Field.js';
type Props = {
  busy: boolean;
  codes: RecoveryCodes | null;
  onRegenerate: (password: string) => Promise<void>;
  onConfirm: () => Promise<void>;
};
function downloadCodes(codes: string[]) {
  const url = URL.createObjectURL(new Blob([codes.join('\n')], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'dentara-codes-recuperation.txt';
  link.click();
  URL.revokeObjectURL(url);
}
export function RecoveryCodesForm({ busy, codes, onRegenerate, onConfirm }: Props) {
  const passwordForm = useForm<{ password: string }>();
  const savedForm = useForm<{ saved: boolean }>();
  const heading = (
    <>
      <h2>Gardez vos codes en lieu sûr</h2>
      <p className="description">
        Ces dix codes à usage unique permettent de récupérer votre compte. Ils ne seront affichés
        qu’une fois.
      </p>
    </>
  );
  if (!codes)
    return (
      <>
        {heading}
        <ValidatedForm
          onSubmit={passwordForm.handleSubmit(async ({ password }) => {
            await onRegenerate(password);
            passwordForm.reset();
          })}
        >
          <p className="hint">
            Les codes précédents ne peuvent pas être réaffichés. Générez un nouveau jeu et
            conservez-le.
          </p>
          <Field label="Mot de passe actuel">
            <input
              type="password"
              autoComplete="current-password"
              {...passwordForm.register('password')}
              required
            />
          </Field>
          <button disabled={busy}>Remplacer mes codes</button>
        </ValidatedForm>
      </>
    );
  return (
    <>
      {heading}
      <ul className="codes">
        {codes.codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <button className="secondary" onClick={() => downloadCodes(codes.codes)}>
        Enregistrer les codes
      </button>
      <ValidatedForm onSubmit={savedForm.handleSubmit(onConfirm)}>
        <label className="checkbox">
          <input type="checkbox" {...savedForm.register('saved')} required />
          J’ai conservé ces codes dans un endroit sûr.
        </label>
        <button disabled={busy}>Terminer la configuration</button>
      </ValidatedForm>
    </>
  );
}
