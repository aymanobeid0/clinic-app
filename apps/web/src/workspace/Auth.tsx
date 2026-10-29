import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { SignIn } from "./SignIn.js";
import { RecoveryForm } from "../features/identity/components/RecoveryForm.js";
import { PasswordForm } from "../features/identity/components/PasswordForm.js";
import { EmailVerificationForm } from "../features/identity/components/EmailVerificationForm.js";
import { RecoveryCodesForm } from "../features/identity/components/RecoveryCodesForm.js";
import type { useIdentitySession } from "../features/identity/useIdentitySession.js";
export type Session = ReturnType<typeof useIdentitySession>;
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <main id="content" className="auth-form">
        <Link className="brand" to="/">
          Clinique
          <span className="brand-mark" aria-hidden="true">
            +
          </span>
        </Link>
        <div className="auth-content">{children}</div>
        <footer>Un espace de travail réservé à votre équipe.</footer>
      </main>
      <aside className="auth-visual" aria-label="Votre espace de travail">
        <div className="visual-orbit" aria-hidden="true">
          <span>+</span>
        </div>
        <div>
          <p className="eyebrow">LE SOIN, EN TOUTE CLARTÉ</p>
          <h2>
            Une équipe.
            <br />
            Une journée bien organisée.
          </h2>
          <p>
            Votre espace pour accompagner chaque patient,
            <br />
            du premier accueil au suivi.
          </p>
        </div>
        <p className="visual-foot">Au rythme de votre clinique.</p>
      </aside>
    </div>
  );
}
export function SessionFeedback({ session }: { session: Session }) {
  return (
    <>
      {session.error && (
        <p role="alert" className="alert">
          {session.error}
        </p>
      )}
      {session.notice && (
        <p role="status" className="notice">
          {session.notice}
        </p>
      )}
    </>
  );
}
export function Auth({ session }: { session: Session }) {
  const location = useLocation();
  const stage = session.identity?.stage;
  return (
    <AuthFrame>
      <SessionFeedback session={session} />
      {stage ? (
        <>
          <h1>Configuration du compte</h1>
          <p className="hint">
            Terminez ces étapes avant d’accéder à la clinique.
          </p>
        </>
      ) : null}
      {stage === "password" ? (
        <PasswordForm busy={session.busy} onSubmit={session.replacePassword} />
      ) : stage === "email" ? (
        <EmailVerificationForm
          busy={session.busy}
          token={session.verificationToken}
          loginEmail={
            session.identity?.recoverySetup
              ? null
              : (session.identity?.loginEmail ?? null)
          }
          onSend={session.sendVerification}
          onVerify={session.verifyEmail}
        />
      ) : stage === "codes" ? (
        <RecoveryCodesForm
          busy={session.busy}
          codes={session.codes}
          onRegenerate={session.regenerateCodes}
          onConfirm={session.confirmSavedCodes}
        />
      ) : location.pathname === "/recuperation" ? (
        <>
          <h1>Retrouver votre accès</h1>
          <RecoveryForm />
          <Link to="/connexion">Retour à la connexion</Link>
        </>
      ) : (
        <SignIn
          busy={session.busy}
          unavailable={session.unavailable}
          onSubmit={session.signIn}
        />
      )}
      {session.unavailable && (
        <button onClick={() => window.location.reload()}>
          Réessayer la connexion au service
        </button>
      )}
      {stage && (
        <button
          className="secondary"
          disabled={session.busy}
          onClick={session.signOut}
        >
          Se déconnecter
        </button>
      )}
    </AuthFrame>
  );
}
