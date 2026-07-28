'use client'

import { useEffect, useState } from 'react'

/**
 * Fotoslider voor een kolomblok.
 *
 * Instellingen 1:1 van de bestaande site (hun swiper op dit blok): crossfade, elke 2500ms een
 * volgende foto, overgang 500ms, oneindig rond, met een vorige/volgende-pijl. De autoplay stopt NIET
 * na een klik — daar staat `disableOnInteraction: false` — dus die van ons ook niet.
 *
 * Eén foto (of geen) = gewoon een stilstaand beeld: geen timer, geen pijltjes.
 */

/** Alleen nl en de zijn actief; onbekende taal valt terug op Nederlands. */
const LABELS: Record<string, { prev: string; next: string }> = {
  nl: { prev: 'Vorige foto', next: 'Volgende foto' },
  de: { prev: 'Vorheriges Foto', next: 'Nächstes Foto' },
}

export function AlbumSlider({ images, alt, locale = 'nl' }: { images: string[]; alt: string; locale?: string }) {
  const slides = images.filter(Boolean)
  const [index, setIndex] = useState(0)
  const labels = LABELS[locale] || LABELS.nl

  useEffect(() => {
    if (slides.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      // Niet doorschuiven in een tabblad dat niemand ziet.
      if (!document.hidden) setIndex((i) => (i + 1) % slides.length)
    }, 2500)
    return () => clearInterval(id)
  }, [slides.length])

  if (!slides.length) return null
  const active = index % slides.length
  const step = (delta: number) => setIndex((i) => (i + delta + slides.length) % slides.length)

  return (
    <div className="album">
      {slides.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src + i}
          src={src}
          alt={i === 0 ? alt : ''}
          className={`album-slide${i === active ? ' is-active' : ''}`}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}
      {slides.length > 1 && (
        /* De pijl zelf is een achtergrond-SVG in de CSS, net als daar — de knoppen zijn dus leeg en
           hebben alleen een aria-label als toegankelijke naam. */
        <div className="album-nav">
          <button type="button" className="album-btn album-btn--prev" aria-label={labels.prev} onClick={() => step(-1)} />
          <button type="button" className="album-btn" aria-label={labels.next} onClick={() => step(1)} />
        </div>
      )}
    </div>
  )
}
