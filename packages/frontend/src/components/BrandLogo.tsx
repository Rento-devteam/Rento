import { Link } from 'react-router-dom'

export function BrandLogo({ large }: { large?: boolean }) {
  return (
    <Link
      to="/"
      className={`rento-logo ${large ? 'rento-logo--lg' : ''}`}
      aria-label="Rento — на главную"
    >
      <span className="rento-logo__mark" aria-hidden>
        <img src="/Logo.svg" alt="" className="rento-logo__image" />
      </span>
      <span className="rento-logo__text">Rento</span>
    </Link>
  )
}
