'use client'

import { useEffect, useRef, useState } from 'react'

import { Icon } from './icons'
import type { Review } from '@/lib/types'

/**
 * Eén beoordelingskaart, in de vorm die de bestaande site laat zien: gekleurd rondje met de
 * beginletter, naam met bevestigingsvinkje, "x geleden op Google", vijf sterren en de tekst die
 * boven de drie regels achter "Lees meer" verdwijnt.
 *
 * De reviews komen uit de content (CMS), niet uit een externe widget — dus geen script van derden en
 * geen cookies. De klant vult ze bij in de Content Editor.
 */

/** Vaste set avatarkleuren; de naam kiest er deterministisch één, zodat dezelfde gast altijd
 *  dezelfde kleur heeft en de klant er geen veld voor hoeft in te vullen. */
const AVATAR_COLORS = ['#7b3fa0', '#3f51b5', '#b5237e', '#00796b', '#c2410c', '#4527a0']

function avatarColor(name: string): string {
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export function ReviewCard({ review, moreLabel, lessLabel }: { review: Review; moreLabel: string; lessLabel: string }) {
  const [open, setOpen] = useState(false)
  const [canToggle, setCanToggle] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)

  // Of "Lees meer" nodig is, hangt af van hoe de tekst uitvalt bij DEZE kolombreedte en dit font —
  // niet van het aantal tekens. Daarom meten we de echte overloop van het ingeklapte blok, en meten
  // we opnieuw als de kaart van breedte verandert. Tijdens uitgeklapt niet meten: dan is er per
  // definitie geen overloop en zou de knop onder je vinger verdwijnen.
  useEffect(() => {
    const el = textRef.current
    if (!el || open) return
    const check = () => setCanToggle(el.scrollHeight > el.clientHeight + 1)
    check()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  const stars = Math.max(0, Math.min(5, Math.round(review.rating)))

  return (
    <article className="review">
      <header className="review-head">
        <span className="review-avatar" style={{ background: avatarColor(review.author) }} aria-hidden="true">
          {review.author.trim().charAt(0).toUpperCase()}
        </span>
        <div className="review-who">
          <p className="review-author">
            {review.author}
            {review.verified && (
              <span className="review-verified" title="Bevestigde recensent">
                <Icon name="check" size={10} />
              </span>
            )}
          </p>
          <p className="review-meta">
            {review.date}
            {review.source && (
              <>
                {' op '}
                {review.sourceLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="review-source-logo" src={review.sourceLogo} alt={review.source} />
                ) : (
                  <span className="review-source">{review.source}</span>
                )}
              </>
            )}
          </p>
        </div>
      </header>

      <p className="review-stars" aria-label={`${stars} van 5 sterren`}>
        {Array.from({ length: stars }, (_, i) => (
          <Icon key={i} name="star" size={17} filled />
        ))}
      </p>

      <p ref={textRef} className={`review-text${open ? '' : ' is-clamped'}`}>
        {review.text}
      </p>

      {canToggle && (
        <button type="button" className="review-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? lessLabel : moreLabel}
        </button>
      )}
    </article>
  )
}
