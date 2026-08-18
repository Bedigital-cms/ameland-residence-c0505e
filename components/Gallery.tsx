'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Icon } from './icons'
import { useLocale } from './LocaleLink'

/**
 * Fotogalerij met lightbox.
 *
 * Villapagina's dragen 25–30 foto's. Die allemaal onder elkaar tonen maakt de pagina eindeloos
 * lang — op de bestaande site opende je de galerij en klikte/scrollde je erdoorheen. Vandaar
 * `preview`: dan staat er één cover met een paar thumbnails en een "bekijk alle foto's"-knop, en
 * gebeurt het bladeren in de lightbox (pijlen, toetsenbord, swipe, thumbnailstrip).
 *
 * Zonder `preview` blijft het de vertrouwde tegelgrid — die vorm gebruiken losse pagina's met een
 * handvol foto's, en die moet niet veranderen.
 */

/** Alleen nl en de zijn actief; onbekende taal valt terug op Nederlands. */
const LABELS: Record<string, { open: (n: number) => string; photo: (n: number) => string; close: string; prev: string; next: string }> = {
  nl: {
    open: (n) => `Bekijk alle ${n} foto's`,
    photo: (n) => `Foto ${n}`,
    close: 'Sluiten',
    prev: 'Vorige foto',
    next: 'Volgende foto',
  },
  de: {
    open: (n) => `Alle ${n} Fotos ansehen`,
    photo: (n) => `Foto ${n}`,
    close: 'Schließen',
    prev: 'Vorheriges Foto',
    next: 'Nächstes Foto',
  },
}

/** Cover + 4 thumbnails: genoeg om de sfeer te tonen, klein genoeg om niet te domineren. */
const PREVIEW_TILES = 5
/** Onder deze afstand is een veeg eerder een tik dan een bladerbeweging. */
const SWIPE_PX = 40

export function Gallery({ images, alt, preview = false }: { images: string[]; alt: string; preview?: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  const locale = useLocale()
  const labels = LABELS[locale] || LABELS.nl
  const shots = (images || []).filter(Boolean)
  const strip = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)

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

  // De actieve thumbnail in beeld houden terwijl je met de pijlen door een lange reeks bladert.
  useEffect(() => {
    if (open === null) return
    strip.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [open])

  if (!shots.length) return null

  const tiles = preview ? shots.slice(0, PREVIEW_TILES) : shots
  const hidden = shots.length - tiles.length

  return (
    <>
      <div className={preview ? 'gallery gallery--preview' : 'gallery'}>
        {tiles.map((src, i) => (
          <button key={src + i} type="button" className="gallery-tile" onClick={() => setOpen(i)} aria-label={`${alt} — ${labels.photo(i + 1)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading={preview && i === 0 ? 'eager' : 'lazy'} />
            {/* Op de laatste tegel het aantal resterende foto's — dezelfde ingang als de knop
                eronder, maar op de plek waar de bezoeker al kijkt. */}
            {preview && hidden > 0 && i === tiles.length - 1 && <span className="gallery-tile-more">+{hidden}</span>}
          </button>
        ))}
      </div>

      {preview && shots.length > 1 && (
        <button type="button" className="gallery-open" onClick={() => setOpen(0)}>
          <Icon name="play" size={15} />
          {labels.open(shots.length)}
        </button>
      )}

      {open !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(null)}>
          <button type="button" className="lightbox-close" aria-label={labels.close} onClick={() => setOpen(null)}>
            <Icon name="close" size={26} />
          </button>
          {shots.length > 1 && (
            <button
              type="button"
              className="lightbox-nav lightbox-prev"
              aria-label={labels.prev}
              onClick={(e) => { e.stopPropagation(); move(-1) }}
            >
              <Icon name="arrow" size={26} />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="lightbox-img"
            src={shots[open]}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
            onTouchEnd={(e) => {
              const from = touchX.current
              touchX.current = null
              if (from === null || shots.length < 2) return
              const dx = e.changedTouches[0].clientX - from
              if (Math.abs(dx) > SWIPE_PX) move(dx < 0 ? 1 : -1)
            }}
          />
          {shots.length > 1 && (
            <button
              type="button"
              className="lightbox-nav lightbox-next"
              aria-label={labels.next}
              onClick={(e) => { e.stopPropagation(); move(1) }}
            >
              <Icon name="arrow" size={26} />
            </button>
          )}
          <span className="lightbox-count">{open + 1} / {shots.length}</span>
          {shots.length > 1 && (
            <div className="lightbox-thumbs" ref={strip} onClick={(e) => e.stopPropagation()}>
              {shots.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  data-active={i === open}
                  className={`lightbox-thumb${i === open ? ' is-active' : ''}`}
                  aria-label={labels.photo(i + 1)}
                  aria-current={i === open}
                  onClick={() => setOpen(i)}
                >
                  {/* Geen lazy-load: de strip scrollt horizontaal, en dan blijven de tegels net
                      buiten beeld leeg op het moment dat je ernaartoe veegt. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
