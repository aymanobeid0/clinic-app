import { FormErrors } from "../../../forms/FormErrors.js";
import { ValidatedForm } from "../../../forms/ValidatedForm.js";
import { useState } from "react";
import {
  permissionSchema,
  type AccountSummary,
  type Identity,
} from "@clinic/contracts";
import { useAccounts } from "../useAccounts.js";
import {
  useAccountEditor,
  useCreateAccount,
  useSelfSettings,
} from "../useAccountForms.js";
import { Field } from "./Field.js";

export function AccountsPanel({ identity }: { identity: Identity }) {
  const { accounts, busy, error, notice, setError, run, reload } =
    useAccounts(identity);
  const [reloadGeneration, setReloadGeneration] = useState(0);
  const { form, submit } = useCreateAccount(run, setError);
  return (
    <section aria-label="Gestion des comptes">
      <h3>Comptes individuels</h3>
      {(error || accounts.error) && (
        <p role="alert">{error || accounts.error?.message}</p>
      )}
      {notice && <p role="status">{notice}</p>}
      {identity.isManager && !identity.historicalOnly && (
        <>
          <ValidatedForm onSubmit={submit}>
            <h4>Créer un compte</h4>
            <Field label="Nom affiché">
              <input
                {...form.register("displayName")}
                required
                maxLength={120}
              />
            </Field>
            <Field label="Nouvel identifiant">
              <input
                {...form.register("username")}
                required
                autoComplete="off"
              />
            </Field>
            <Field label="Profil">
              <select {...form.register("kind")}>
                <option value="staff">Personnel</option>
                <option value="doctor">Dentiste</option>
              </select>
            </Field>
            <Field label="Mot de passe temporaire">
              <input
                type="password"
                {...form.register("temporaryPassword")}
                minLength={12}
                required
                autoComplete="new-password"
              />
            </Field>
            <Field label="Votre mot de passe actuel">
              <input
                type="password"
                {...form.register("currentPassword")}
                required
                autoComplete="current-password"
              />
            </Field>
            <button disabled={busy}>Créer le compte</button>
            <p>
              Communiquez ces identifiants en personne. Le mot de passe expire
              après 24 heures.
            </p>
          <FormErrors errors={form.formState.errors} />
</ValidatedForm>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await reload();
              setReloadGeneration((value) => value + 1);
            }}
          >
            Recharger les comptes et abandonner mes modifications
          </button>
          {accounts.data?.map((a) => (
            <AccountEditor
              key={`${a.id}:${reloadGeneration}`}
              account={a}
              busy={busy}
              run={run}
            />
          ))}
        </>
      )}
      <SelfSettings busy={busy} run={run} isManager={identity.isManager} />
    </section>
  );
}
function AccountEditor({
  account: a,
  busy,
  run,
}: {
  account: AccountSummary;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { form, operation, setOperation, submit } = useAccountEditor(a, run);
  return (
    <ValidatedForm onSubmit={submit}>
      <h4>
        {a.displayName} ({a.username})
      </h4>
      <p>
        {a.kind === "doctor" ? "Dentiste" : "Personnel"}
        {a.isManager ? " · Responsable" : ""} ·{" "}
        {a.disabled
          ? "Désactivé"
          : a.historicalOnly
            ? "Historique uniquement"
            : "Actif"}
      </p>
      <Field label={`Action pour ${a.username}`}>
        <select
          value={operation}
          onChange={(e) => setOperation(e.target.value)}
        >
          <option value="permissions">Modifier les autorisations</option>
          <option value="username">Modifier l’identifiant demandé</option>
          <option value="reset-password">Réinitialiser le mot de passe</option>
          <option value="kind">Modifier le profil</option>
          <option value="manager">Autorité responsable</option>
          <option value="status">État du compte</option>
        </select>
      </Field>
      {operation === "permissions" && (
        <fieldset>
          <legend>Autorisations individuelles</legend>
          {permissionSchema.options.map((p) => (
            <label key={p}>
              <input
                type="checkbox"
                value={p}
                {...form.register("permissions")}
              />
              {permissionLabel(p)}
            </label>
          ))}
        </fieldset>
      )}
      {operation === "username" && (
        <Field label="Identifiant demandé">
          <input {...form.register("username")} required />
        </Field>
      )}
      {operation === "reset-password" && (
        <Field label="Nouveau mot de passe temporaire">
          <input
            type="password"
            autoComplete="new-password"
            {...form.register("temporaryPassword")}
            minLength={12}
            required
          />
        </Field>
      )}
      {operation === "kind" && (
        <Field label="Nouveau profil">
          <select {...form.register("kind")}>
            <option value="staff">Personnel</option>
            <option value="doctor">Dentiste</option>
          </select>
        </Field>
      )}
      {operation === "manager" && (
        <label>
          <input type="checkbox" {...form.register("isManager")} />
          Responsable de la clinique
        </label>
      )}
      {operation === "status" && (
        <Field label="Nouvel état">
          <select {...form.register("status")}>
            <option value="active">Restaurer actif</option>
            <option value="historical">Historique uniquement</option>
            <option value="disabled">Désactiver</option>
          </select>
        </Field>
      )}
      <Field label={`Confirmez votre mot de passe pour ${a.username}`}>
        <input
          type="password"
          autoComplete="current-password"
          {...form.register("currentPassword")}
          required
        />
      </Field>
      <button disabled={busy}>Enregistrer pour {a.username}</button>
    <FormErrors errors={form.formState.errors} />
</ValidatedForm>
  );
}
const nouns: Record<string, string> = {
  patients: "Patients",
  appointments: "Rendez-vous",
  clinical: "Dossier clinique",
  chart: "Schéma dentaire",
  history: "Antécédents",
  plans: "Plans de traitement",
  notes: "Notes",
  prescriptions: "Ordonnances",
  acceptance: "Preuve d’acceptation",
  procedures: "Actes",
  attachments: "Pièces jointes",
  catalog: "Catalogue",
  billing: "Facturation",
  payments: "Paiements",
  receipts: "Reçus",
  invoices: "Factures",
  financial: "Finances",
  inventory: "Stock",
  reports: "Rapports",
  exports: "Exports",
  mixed: "Fichiers mixtes",
};
const verbs: Record<string, string> = {
  read: "Consulter",
  create: "Créer",
  edit: "Modifier",
  archive: "Archiver/restaurer",
  assign: "Attribuer/partager",
  manage: "Gérer",
  override: "Autoriser les exceptions",
  history: "Historique",
  draft: "Rédiger un brouillon",
  finalize: "Finaliser",
  accept: "Confirmer l’acceptation",
  start: "Commencer",
  complete: "Terminer",
  sign: "Signer",
  upload: "Ajouter",
  replace: "Remplacer",
  remove: "Retirer",
  record: "Enregistrer",
  issue: "Émettre",
  refunds: "Rembourser",
  reversals: "Annuler un paiement",
  discounts: "Remises",
  prices: "Prix",
  receive: "Recevoir",
  consume: "Consommer",
  adjust: "Ajuster",
  operational: "Opérations",
  print: "Imprimer",
  download: "Télécharger",
};
function permissionLabel(p: string) {
  return p
    .split(".")
    .map((part, i) =>
      i === 0
        ? (nouns[part] ?? verbs[part] ?? part)
        : (verbs[part] ?? nouns[part] ?? part),
    )
    .join(" — ");
}
function SelfSettings({
  busy,
  run,
  isManager,
}: {
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<boolean>;
  isManager: boolean;
}) {
  const { password, email, submitPassword, submitEmail } = useSelfSettings(run);
  return (
    <>
      <ValidatedForm onSubmit={submitPassword}>
        <h4>Changer mon mot de passe</h4>
        <Field label="Mot de passe actuel">
          <input
            type="password"
            {...password.register("currentPassword")}
            required
            autoComplete="current-password"
          />
        </Field>
        <Field label="Nouveau mot de passe personnel">
          <input
            type="password"
            {...password.register("password")}
            minLength={12}
            maxLength={128}
            required
            autoComplete="new-password"
          />
        </Field>
        <button disabled={busy}>Changer mon mot de passe</button>
      <FormErrors errors={password.formState.errors} />
</ValidatedForm>
      {isManager && (
        <ValidatedForm onSubmit={submitEmail}>
          <h4>Changer mon adresse de récupération</h4>
          <Field label="Nouvelle adresse e-mail">
            <input type="email" {...email.register("email")} required />
          </Field>
          <Field label="Mot de passe actuel pour l’adresse">
            <input
              type="password"
              {...email.register("currentPassword")}
              required
              autoComplete="current-password"
            />
          </Field>
          <button disabled={busy}>Vérifier la nouvelle adresse</button>
          <p>
            L’ancienne adresse reste active jusqu’à la vérification. Ouvrez le
            lien reçu et saisissez son code dans la vérification.
          </p>
        <FormErrors errors={email.formState.errors} />
</ValidatedForm>
      )}
    </>
  );
}
