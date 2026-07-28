'use client'

import { useCallback, useEffect, useState } from 'react'

import { Icon } from './icons'

/**
 * Photo grid with a lightbox. Villa pages carry 25–30 interior shots, so the grid stays compact
 * (uniform square tiles) and the full image only loads when a visitor opens it.
 */
export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const shots = (images || []).filter(Boolean)

  const move = useCallback(
    (delta: number) => setOpen((i) => (i === null ? null : (i + delta + shots.length) % shots.length)),
    [shots.length],
  )

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') move(1)
      if (e.key === 'ArrowLeft') move(-1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, move])

  if (!shots.length) return null

  return (
    <>
      <div className="gallery">
        {shots.map((src, i) => (
          <button key={src + i} type="button" className="gallery-tile" onClick={() => setOpen(i)} aria-label={`${alt} — foto ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading="lazy" />
          </button>
        ))}
      </div>

      {open !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(null)}>
          <button type="button" className="lightbox-close" aria-label="Sluiten" onClick={() => setOpen(null)}>
            <Icon name="close" size={26} />
          </button>
          {shots.length > 1 && (
            <button
              type="button"
              className="lightbox-nav lightbox-prev"
              aria-label="Vorige"
              onClick={(e) => { e.stopPropagation(); move(-1) }}
            >
              <Icon name="arrow" size={26} />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lightbox-img" src={shots[open]} alt={alt} onClick={(e) => e.stopPropagation()} />
          {shots.length > 1 && (
            <button
              type="button"
              className="lightbox-nav lightbox-next"
              aria-label="Volgende"
              onClick={(e) => { e.stopPropagation(); move(1) }}
            >
              <Icon name="arrow" size={26} />
            </button>
          )}
          <span className="lightbox-count">{open + 1} / {shots.length}</span>
        </div>
      )}
    </>
  )
}
