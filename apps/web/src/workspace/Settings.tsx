import { create } from "zustand";
import { PasswordForm } from "../features/identity/components/PasswordForm.js";
import { RecoveryCodesForm } from "../features/identity/components/RecoveryCodesForm.js";
import type { Session } from "./Auth.js";
// Personal appearance only. No identity, clinical data or credentials are persisted.
export const useAppearance = create<{
  theme: "blue" | "teal";
  setTheme: (theme: "blue" | "teal") => void;
}>((set) => ({ theme: "blue", setTheme: (theme) => set({ theme }) }));
export function Settings({ session }: { session: Session }) {
  const { theme, setTheme } = useAppearance();
  return (
    <>
      <p className="eyebrow">VOTRE ESPACE</p>
      <h1>Mes préférences</h1>
      <section className="surface">
        <h2>Apparence</h2>
        <p>Choisissez la couleur de votre espace pour cette session.</p>
        <div className="palette">
          <button
            aria-pressed={theme === "blue"}
            onClick={() => setTheme("blue")}
          >
            Bleu
          </button>
          <button
            aria-pressed={theme === "teal"}
            onClick={() => setTheme("teal")}
          >
            Sarcelle
          </button>
        </div>
      </section>
      {!session.identity?.historicalOnly && (
        <section className="surface">
          <h2>Sécurité du compte</h2>
          <details>
            <summary>Changer mon mot de passe</summary>
            <PasswordForm
              busy={session.busy}
              onSubmit={session.replacePassword}
            />
          </details>
          {session.identity?.isManager && (
            <details>
              <summary>Renouveler mes codes de récupération</summary>
              <RecoveryCodesForm
                busy={session.busy}
                codes={session.codes}
                onRegenerate={session.regenerateCodes}
                onConfirm={session.confirmSavedCodes}
              />
            </details>
          )}
        </section>
      )}
    </>
  );
}
