import { useState } from 'react'

const DEFAULT_SRC = '/Logo.svg'

/**
 * Слот под иконку приложения. Использует `public/Logo.svg`.
 */
export function AppIconSlot() {
  const [failed, setFailed] = useState(false)
  const src = DEFAULT_SRC

  return (
    <div className="auth-figma-app-icon-slot" role="presentation">
      {!failed ? (
        <img
          src={src}
          alt=""
          className="auth-figma-app-icon-img"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="auth-figma-app-icon-fallback" />
      )}
    </div>
  )
}
