import { Link } from "react-router-dom";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="container app-footer__inner">
        <span className="app-footer__brand">Rento</span>
        <nav className="app-footer__nav" aria-label="Справка и документы">
          <Link to="/guide" className="app-footer__link">
            Как пользоваться сервисом
          </Link>
          <Link to="/terms" className="app-footer__link">
            Пользовательское соглашение
          </Link>
        </nav>
      </div>
    </footer>
  );
}
