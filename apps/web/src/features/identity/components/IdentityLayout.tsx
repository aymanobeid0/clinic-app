import type { ReactNode } from 'react';
export function IdentityLayout({ children }: { children: ReactNode }) {
  return (
    <main className="entry">
      <aside className="intro">
        <a className="brand" href="/" aria-label="Dentara, accueil">
          <span className="brand-mark">D</span>Dentara<span className="brand-dot">.</span>
        </a>
        <div className="intro-copy">
          <span className="eyebrow">VOTRE ESPACE CLINIQUE</span>
          <h1>
            Le soin commence
            <br />
            par la simplicité.
          </h1>
          <p>
            Un espace commun pour votre équipe.
            <br />
            Un accès personnel pour chaque membre.
          </p>
          <div className="line-art" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <small>Une organisation sereine, au quotidien.</small>
      </aside>
      <section className="panel" aria-label="Accès à votre clinique">
        <div className="panel-top">
          ESPACE SÉCURISÉ <span>FR</span>
        </div>
        <div className="form-card">{children}</div>
        <footer>Vos données restent dans votre espace clinique.</footer>
      </section>
    </main>
  );
}
