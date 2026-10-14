import { RecoveryForm } from './components/RecoveryForm.js';
import { AccountsPanel } from './components/AccountsPanel.js';
import { useIdentitySession } from './useIdentitySession.js';
import { IdentityLayout } from './components/IdentityLayout.js';
import { SignInForm } from './components/SignInForm.js';
import { PasswordForm } from './components/PasswordForm.js';
import { EmailVerificationForm } from './components/EmailVerificationForm.js';
import { RecoveryCodesForm } from './components/RecoveryCodesForm.js';
import { PatientsPanel } from '../patients/PatientsPanel.js';
import { PatientAccessPanel } from '../patient-access/PatientAccessPanel.js';

export function IdentityPage() {
  const session = useIdentitySession();
  const stage = session.identity?.stage;

  function renderStep() {
    if (session.loading) return <p role="status">Chargement…</p>;
    if (session.identity?.historicalOnly)
      return (
        <>
          <h2>Historique uniquement</h2>
          <p>
            Votre accès est limité aux historiques explicitement autorisés. Un responsable doit
            restaurer votre compte pour les opérations courantes.
          </p>
        </>
      );
    switch (stage) {
      case 'password':
        return <PasswordForm busy={session.busy} onSubmit={session.replacePassword} />;
      case 'email':
        return (
          <EmailVerificationForm
            loginEmail={
              session.identity?.recoverySetup ? null : (session.identity?.loginEmail ?? null)
            }
            busy={session.busy}
            token={session.verificationToken}
            onSend={session.sendVerification}
            onVerify={session.verifyEmail}
          />
        );
      case 'codes':
        return (
          <RecoveryCodesForm
            busy={session.busy}
            codes={session.codes}
            onRegenerate={session.regenerateCodes}
            onConfirm={session.confirmSavedCodes}
          />
        );
      case 'ready':
        return (
          <>
            <h2>{session.clinic?.name ?? 'Votre clinique'}</h2>
            <p className="description">
              Bonjour {session.identity?.displayName}. Votre compte est prêt.
            </p>
            {session.identity && <AccountsPanel identity={session.identity} />}
            {session.identity && (
              <PatientAccessPanel
                key={`access:${session.identity.clinicId}:${session.identity.accountId}`}
                identity={session.identity}
              />
            )}
            {session.identity && (
              <PatientsPanel
                key={`${session.identity.clinicId}:${session.identity.accountId}`}
                identity={session.identity}
              />
            )}
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
            {session.verificationToken && (
              <EmailVerificationForm
                loginEmail={null}
                busy={session.busy}
                token={session.verificationToken}
                onSend={session.sendVerification}
                onVerify={session.verifyEmail}
              />
            )}
            <div className="ready">
              <span className="ready-icon" aria-hidden="true">
                ✓
              </span>
              <h3>Configuration terminée</h3>
              <p>L’accès à votre clinique est actif.</p>
              <p className="hint">Les autres fonctions seront ajoutées progressivement.</p>
            </div>
          </>
        );
      default:
        return (
          <>
            <RecoveryForm />
            <SignInForm
              busy={session.busy}
              unavailable={session.unavailable}
              onSubmit={session.signIn}
              onInvalid={session.setValidationError}
            />
          </>
        );
    }
  }

  return (
    <IdentityLayout>
      <div className="step">
        {stage && stage !== 'ready' ? 'CONFIGURATION DU COMPTE' : 'BIENVENUE'}
      </div>
      {session.error && (
        <p className="alert" role="alert">
          {session.error}
        </p>
      )}
      {session.notice && (
        <p className="notice" role="status">
          {session.notice}
        </p>
      )}
      {renderStep()}
      {stage && (
        <button className="signout" disabled={session.busy} onClick={session.signOut}>
          Se déconnecter
        </button>
      )}
    </IdentityLayout>
  );
}
