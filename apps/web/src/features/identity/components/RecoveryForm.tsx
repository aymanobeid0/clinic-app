import { useRecovery } from "../useRecovery.js";
import { Field } from "./Field.js";
export function RecoveryForm() {
  const { form, method, route, setRoute, error, notice, busy, submit } =
    useRecovery();
  return (
    <details>
      <summary>Récupérer mon compte responsable</summary>
      <form onSubmit={submit}>
        <p>
          Pour l’équipe, demandez une réinitialisation à votre responsable. Les
          codes ne réactivent pas un compte désactivé.
        </p>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <Field label="Identité à récupérer">
          <select {...form.register("method")}>
            <option value="email">Responsable principal — e-mail</option>
            <option value="clinic_username">
              Responsable — identifiant clinique
            </option>
          </select>
        </Field>
        {method === "email" ? (
          <Field label="Adresse e-mail du compte">
            <input type="email" {...form.register("email")} required />
          </Field>
        ) : (
          <>
            <Field label="Code clinique du compte">
              <input {...form.register("clinicCode")} required />
            </Field>
            <Field label="Identifiant du compte">
              <input {...form.register("username")} required />
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
        {route === "code" && (
          <Field label="Code de récupération">
            <input {...form.register("code")} required autoComplete="off" />
          </Field>
        )}
        {route === "email" && (
          <Field label="Jeton du lien de récupération">
            <input {...form.register("token")} required autoComplete="off" />
          </Field>
        )}
        {route !== "request" && (
          <Field label="Nouveau mot de passe de récupération">
            <input
              type="password"
              {...form.register("password")}
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </Field>
        )}
        <button disabled={busy}>
          {route === "request"
            ? "Envoyer le lien"
            : "Récupérer et vérifier mes coordonnées"}
        </button>
      </form>
    </details>
  );
}
