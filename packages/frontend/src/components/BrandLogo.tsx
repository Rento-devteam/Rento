import { Link } from 'react-router-dom'

/** `public/Logo.svg` — при `vite build` попадает в `dist/Logo.svg`. */
export const LOGO_SRC = '/Logo.svg'

interface BrandLogoProps {
  to?: string
}

export function BrandLogo({ to = '/' }: BrandLogoProps) {
  return (
    <Link to={to} className="brand" aria-label="Rento — на главную">
      <span className="brand__mark" aria-hidden>
        <img src={LOGO_SRC} alt="" className="brand__mark-img" width={32} height={32} />
      </span>
      <span>Rento</span>
    </Link>
  )
}
