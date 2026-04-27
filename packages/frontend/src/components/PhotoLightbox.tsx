import { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

export type PhotoLightboxSlide = {
  url: string
  alt?: string
}

type PhotoLightboxProps = {
  open: boolean
  slides: PhotoLightboxSlide[]
  index: number
  onClose: () => void
  onNavigate: (nextIndex: number) => void
}

export function PhotoLightbox({ open, slides, index, onClose, onNavigate }: PhotoLightboxProps) {
  const safeIndex = slides.length > 0 ? Math.min(Math.max(0, index), slides.length - 1) : 0
  const slide = slides[safeIndex]

  const goPrev = useCallback(() => {
    if (slides.length < 2) return
    onNavigate((safeIndex - 1 + slides.length) % slides.length)
  }, [slides.length, safeIndex, onNavigate])

  const goNext = useCallback(() => {
    if (slides.length < 2) return
    onNavigate((safeIndex + 1) % slides.length)
  }, [slides.length, safeIndex, onNavigate])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose, goPrev, goNext])

  if (!open || slides.length === 0 || typeof document === 'undefined') {
    return null
  }

  if (!slide) {
    return null
  }

  const content = (
    <div
      className="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фотографии"
      onClick={onClose}
    >
      <button
        type="button"
        className="photo-lightbox__close"
        aria-label="Закрыть"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        ×
      </button>

      {slides.length > 1 ? (
        <button
          type="button"
          className="photo-lightbox__nav photo-lightbox__nav--prev"
          aria-label="Предыдущее фото"
          onClick={(e) => {
            e.stopPropagation()
            goPrev()
          }}
        >
          ‹
        </button>
      ) : null}

      {slides.length > 1 ? (
        <button
          type="button"
          className="photo-lightbox__nav photo-lightbox__nav--next"
          aria-label="Следующее фото"
          onClick={(e) => {
            e.stopPropagation()
            goNext()
          }}
        >
          ›
        </button>
      ) : null}

      <div className="photo-lightbox__stage" onClick={(e) => e.stopPropagation()}>
        <img
          className="photo-lightbox__img"
          src={slide.url}
          alt={slide.alt ?? ''}
          draggable={false}
        />
        {slides.length > 1 ? (
          <p className="photo-lightbox__counter">
            {safeIndex + 1} / {slides.length}
          </p>
        ) : null}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
