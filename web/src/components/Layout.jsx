import { Link, NavLink } from 'react-router-dom';
import { PageTransition, ScrollProgress } from '../motion';
import { site } from '../site.config.js';

export default function Layout({ children }) {
  return (
    <>
      <ScrollProgress className="progress" />
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label={site.name + ' home'}>
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" fill="#0a0a0a" /><rect x="6" y="6" width="9" height="20" fill="#ffe500" /><rect x="15" y="6" width="11" height="6" fill="#ffe500" /><rect x="15" y="20" width="11" height="6" fill="#ffe500" /><rect x="18" y="12" width="8" height="8" fill="#ff3d00" /></svg>
          <span>BLUFFCHECK</span>
        </Link>
        <nav aria-label="Main">
          <NavLink to="/audit">Audit</NavLink>
          <NavLink to="/history">History</NavLink>
        </nav>
      </header>
      <main id="main"><PageTransition>{children}</PageTransition></main>
      <footer className="site-footer">
        <div>
          <strong>BLUFFCHECK</strong>
          <p>Audits JavaScript functions in an isolated sandbox. Results are evidence, not proof of correctness.</p>
        </div>
        <nav aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          {site.repoUrl ? <a href={site.repoUrl} rel="noreferrer">Source</a> : null}
        </nav>
      </footer>
    </>
  );
}
