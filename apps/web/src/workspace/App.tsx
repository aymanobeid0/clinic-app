import { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { useIdentitySession } from "../features/identity/useIdentitySession.js";
import { Auth, AuthFrame, SessionFeedback, type Session } from "./Auth.js";
import { Dashboard } from "./Dashboard.js";
import { Settings, useAppearance } from "./Settings.js";
import { Icon } from "./Icon.js";
function NotFound() {
  return (
    <>
      <h1>Page introuvable</h1>
      <p>Cette adresse ne correspond à aucune page disponible.</p>
      <Link to="/">Revenir à mon espace</Link>
    </>
  );
}
function Workspace({ session }: { session: Session }) {
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    setMenu(false);
    content.current?.focus();
  }, [location.pathname]);
  const historical = session.identity?.historicalOnly;
  return (
    <div className="workspace">
      <a className="skip-link" href="#content">
        Aller au contenu
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/">
          Clinique
          <span className="brand-mark" aria-hidden="true">
            +
          </span>
        </Link>
        <button
          className="mobile-menu secondary"
          aria-expanded={menu}
          aria-controls="navigation"
          onClick={() => setMenu(!menu)}
        >
          Menu
        </button>
        <nav
          id="navigation"
          className={menu ? "is-open" : ""}
          aria-label="Navigation principale"
        >
          <p className="eyebrow">MON ESPACE</p>
          <NavLink to={historical ? "/historique" : "/workspace"}>
            <Icon name="dashboard" />
            {historical ? "Accès historique" : "Tableau de bord"}
          </NavLink>
          <NavLink to="/preferences">
            <Icon name="settings" />
            Mes préférences
          </NavLink>
        </nav>
        <div className="sidebar-account">
          <strong>{session.identity?.displayName}</strong>
          <span>
            {historical
              ? "Historique uniquement"
              : session.identity?.isManager
                ? "Responsable"
                : session.identity?.kind === "doctor"
                  ? "Médecin"
                  : "Équipe"}
          </span>
          <button
            className="secondary"
            disabled={session.busy}
            onClick={session.signOut}
          >
            Se déconnecter
          </button>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <span>{session.clinic?.name ?? "Votre espace clinique"}</span>
          <span className="badge">
            {historical ? "Lecture seule" : "Espace de travail"}
          </span>
        </header>
        <main id="content" ref={content} tabIndex={-1}>
          <SessionFeedback session={session} />
          <Routes>
            <Route
              path="/"
              element={
                <Navigate
                  replace
                  to={historical ? "/historique" : "/workspace"}
                />
              }
            />
            <Route
              path="/connexion"
              element={
                <Navigate
                  replace
                  to={historical ? "/historique" : "/workspace"}
                />
              }
            />
            <Route
              path="/workspace"
              element={
                historical ? (
                  <>
                    <h1>Accès refusé</h1>
                    <p>
                      Votre compte est limité aux historiques explicitement
                      autorisés.
                    </p>
                    <Link to="/historique">Consulter mon accès</Link>
                  </>
                ) : session.identity ? (
                  <Dashboard identity={session.identity} />
                ) : null
              }
            />
            <Route
              path="/preferences"
              element={<Settings session={session} />}
            />
            <Route
              path="/historique"
              element={
                <>
                  <h1>Accès historique</h1>
                  <section className="surface">
                    <h2>Historique uniquement</h2>
                    <p>
                      Votre accès reste limité aux versions explicitement
                      autorisées. Les vues historiques seront disponibles dans
                      leur espace dédié ; aucune opération courante n’est
                      accessible ici.
                    </p>
                  </section>
                </>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
function Application() {
  const session = useIdentitySession();
  const theme = useAppearance((s) => s.theme);
  const location = useLocation();
  useEffect(() => {
    document.title = "Clinique · Espace de travail";
  }, []);
  if (session.loading)
    return (
      <div data-theme={theme}>
        <AuthFrame>
          <h1>Votre espace clinique</h1>
          <p role="status">Vérification de votre accès…</p>
        </AuthFrame>
      </div>
    );
  if (
    session.identity?.stage === "ready" &&
    session.verificationToken &&
    location.pathname !== "/preferences"
  )
    return <Navigate replace to="/preferences" />;
  if (
    !session.identity &&
    location.pathname !== "/recuperation" &&
    new URLSearchParams(location.hash.slice(1)).has("recovery")
  )
    return <Navigate replace to={"/recuperation" + location.hash} />;
  const known = [
    "/",
    "/connexion",
    "/recuperation",
    "/workspace",
    "/preferences",
    "/historique",
  ].includes(location.pathname);
  return (
    <div data-theme={theme} className="clinic-app">
      {session.identity?.stage === "ready" ? (
        <Workspace key={session.scopeKey} session={session} />
      ) : !known ? (
        <AuthFrame>
          <NotFound />
        </AuthFrame>
      ) : (
        <Auth key={session.scopeKey} session={session} />
      )}
    </div>
  );
}
export function App() {
  return (
    <BrowserRouter>
      <Application />
    </BrowserRouter>
  );
}
