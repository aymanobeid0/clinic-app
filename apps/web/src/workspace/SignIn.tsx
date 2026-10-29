import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, type SignIn as Input } from "@clinic/contracts";
import type { z } from "zod";
import { Link } from "react-router";
import { ValidatedForm } from "../forms/ValidatedForm.js";
import { FormErrors } from "../forms/FormErrors.js";
import { Field } from "../features/identity/components/Field.js";

export function SignIn({
  busy,
  unavailable,
  onSubmit,
}: {
  busy: boolean;
  unavailable: boolean;
  onSubmit: (input: Input) => Promise<void>;
}) {
  const form = useForm<z.input<typeof signInSchema>, unknown, Input>({
    resolver: zodResolver(signInSchema),
    defaultValues: { method: "email" },
    shouldUnregister: true,
  });
  const method = form.watch("method");
  return (
    <>
      <p className="eyebrow">VOTRE ESPACE CLINIQUE</p>
      <h1>Connexion à votre clinique</h1>
      <p className="description">
        Retrouvez votre équipe et le fil de votre journée.
      </p>
      <div className="login-methods" aria-label="Mode de connexion">
        <button
          type="button"
          aria-pressed={method === "email"}
          disabled={busy}
          onClick={() => form.setValue("method", "email")}
        >
          Responsable principal
        </button>
        <button
          type="button"
          aria-pressed={method === "clinic_username"}
          disabled={busy}
          onClick={() => form.setValue("method", "clinic_username")}
        >
          Équipe
        </button>
      </div>
      <ValidatedForm
        onSubmit={form.handleSubmit(async (input) => {
          await onSubmit(input);
          form.reset({ ...form.getValues(), password: "" });
        })}
      >
        <input type="hidden" {...form.register('method')} />
        <div className="login-identifiers">
          {method === "email" ? (
            <Field label="Adresse e-mail de connexion">
              <input
                type="email"
                autoComplete="username"
                required
                {...form.register("email")}
              />
            </Field>
          ) : (
            <>
              <Field label="Code de la clinique">
                <input
                  autoComplete="organization"
                  required
                  {...form.register("clinicCode")}
                />
              </Field>
              <Field label="Identifiant">
                <input
                  autoComplete="username"
                  required
                  {...form.register("username")}
                />
              </Field>
            </>
          )}
        </div>
        <Field label="Mot de passe">
          <input
            type="password"
            autoComplete="current-password"
            required
            {...form.register("password")}
          />
        </Field>
        <button className="primary login-submit" disabled={busy || unavailable}>
          {busy ? "Connexion…" : "Se connecter"}{" "}
          <span aria-hidden="true">→</span>
        </button>
        <FormErrors errors={form.formState.errors} />
      </ValidatedForm>
      <Link className="recovery-link" to="/recuperation">
        Mot de passe oublié ?
      </Link>
      <p className="hint">
        Équipe et médecins responsables : utilisez les identifiants remis par
        votre responsable. Aucun compte ne peut être créé ici.
      </p>
    </>
  );
}
