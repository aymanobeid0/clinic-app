import { usePersonalSettings } from "../features/identity/usePersonalSettings.js";
import { Field } from "../features/identity/components/Field.js";
import { EmailVerificationForm } from "../features/identity/components/EmailVerificationForm.js";
import { ValidatedForm } from "../forms/ValidatedForm.js";
import type { Session } from "./Auth.js";
export function PersonalSecurity({ session }: { session: Session }) {
  const settings = usePersonalSettings();
  return (
    <>
      {settings.error && <p role="alert">{settings.error}</p>}
      {settings.notice && <p role="status">{settings.notice}</p>}
      <details>
        <summary>Changer mon mot de passe</summary>
        <ValidatedForm onSubmit={settings.submitPassword}>
          <Field label="Mot de passe actuel">
            <input
              type="password"
              autoComplete="current-password"
              required
              {...settings.password.register("currentPassword")}
            />
          </Field>
          <Field label="Nouveau mot de passe personnel">
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              {...settings.password.register("password")}
            />
          </Field>
          <p className="hint">
            Le changement ferme vos sessions. Reconnectez-vous avec votre
            nouveau mot de passe.
          </p>
          <button disabled={settings.busy}>Changer mon mot de passe</button>
        </ValidatedForm>
      </details>
      {(session.identity?.isManager ||
        session.identity?.loginMethod === "email") && (
        <details open={!!session.verificationToken}>
          <summary>Changer mon adresse de récupération</summary>
          <ValidatedForm onSubmit={settings.submitEmail}>
            <Field label="Nouvelle adresse e-mail">
              <input
                type="email"
                autoComplete="email"
                required
                {...settings.email.register("email")}
              />
            </Field>
            <Field label="Mot de passe actuel pour l’adresse">
              <input
                type="password"
                autoComplete="current-password"
                required
                {...settings.email.register("currentPassword")}
              />
            </Field>
            <p className="hint">
              L’ancienne adresse reste active jusqu’à la vérification de la
              nouvelle adresse.
            </p>
            <button disabled={settings.busy}>
              Vérifier la nouvelle adresse
            </button>
          </ValidatedForm>
          <EmailVerificationForm
            verifyOnly
            busy={session.busy}
            token={session.verificationToken}
            loginEmail={null}
            onSend={session.sendVerification}
            onVerify={session.verifyEmail}
          />
        </details>
      )}
    </>
  );
}
