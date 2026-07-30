'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Icon } from './icons'

/**
 * Photo grid with an accessible lightbox. Villa pages carry 25–30 interior shots, so the grid stays
 * compact (uniform square tiles) and the full image only loads when a visitor opens it.
 *
 * ACCESSIBILITY — what a modal dialog has to do, and what this was missing:
 *
 *  · FOCUS MOVES IN. On open, focus goes to the close button. Without it a keyboard user's focus stays
 *    on the thumbnail behind the overlay: they are "in" a dialog they cannot reach.
 *  · FOCUS IS TRAPPED. Tab cycles within the dialog. Otherwise Tab walks into the page behind the
 *    overlay — invisible, but still focusable and clickable.
 *  · FOCUS COMES BACK. On close, focus returns to the thumbnail that opened it, so the reading position
 *    is not lost.
 *  · Escape closes and arrows navigate (both already present), and the control labels are localised —
 *    they were hardcoded Dutch, so a German visitor's screen reader announced "Sluiten"/"Volgende".
 *
 * Why `<img>` rather than next/image, and the lazy-loading strategy: see `Media.tsx`.
 */
export function Gallery({
  images,
  alt,
  labels,
}: {
  images: string[]
  alt: string
  /** Localised control labels. Falls back to Dutch when a caller has not supplied them. */
  labels?: { close: string; prev: string; next: string; photo: string }
}) {
  const [open, setOpen] = useState<number | null>(null)
  const shots = (images || []).filter(Boolean)

  const l = labels ?? { close: 'Sluiten', prev: 'Vorige', next: 'Volgende', photo: 'foto' }

  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  /** The thumbnail that opened the lightbox, so focus can be handed back to it. */
  const openerRef = useRef<HTMLButtonElement | null>(null)

  const move = useCallback(
    (delta: number) => setOpen((i) => (i === null ? null : (i + delta + shots.length) % shots.length)),
    [shots.length],
  )

  const close = useCallback(() => {
    setOpen(null)
    openerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (open === null) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key === 'ArrowRight') move(1)
      if (e.key === 'ArrowLeft') move(-1)
      if (e.key !== 'Tab') return

      // Trap Tab inside the dialog: wrap from the last control to the first and vice versa.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // Move focus into the dialog so it is immediately operable by keyboard.
    closeRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, move, close])

  if (!shots.length) return null

  return (
    <>
      <div className="gallery">
        {shots.map((src, i) => (
          <button
            key={src + i}
            type="button"
            className="gallery-tile"
            onClick={(e) => {
              openerRef.current = e.currentTarget
              setOpen(i)
            }}
            aria-label={`${alt} — ${l.photo} ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              width={600}
              height={600}
              sizes="(max-width: 700px) 50vw, 25vw"
            />
          </button>
        ))}
      </div>

      {open !== null && (
        <div ref={dialogRef} className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={close}>
          <button ref={closeRef} type="button" className="lightbox-close" aria-label={l.close} onClick={close}>
            <Icon name="close" size={26} />
          </button>
          {shots.length > 1 && (
            <button
              type="button"
              className="lightbox-nav lightbox-prev"
              aria-label={l.prev}
              onClick={(e) => { e.stopPropagation(); move(-1) }}
            >
              <Icon name="arrow" size={26} />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="lightbox-img"
            src={shots[open]}
            // The opened photo is what the visitor asked for, so it gets a real alt and is not lazy.
            alt={`${alt} — ${l.photo} ${open + 1}`}
            onClick={(e) => e.stopPropagation()}
            decoding="async"
          />
          {shots.length > 1 && (
            <button
              type="button"
              className="lightbox-nav lightbox-next"
              aria-label={l.next}
              onClick={(e) => { e.stopPropagation(); move(1) }}
            >
              <Icon name="arrow" size={26} />
            </button>
          )}
          <span className="lightbox-count" aria-live="polite">
            {open + 1} / {shots.length}
          </span>
        </div>
      )}
    </>
  )
}
