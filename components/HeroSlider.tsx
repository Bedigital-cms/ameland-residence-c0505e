'use client'

import { useEffect, useState } from 'react'

/**
 * Full-bleed hero slider. Cross-fades through the images every 6s (paused when the tab is hidden or
 * the visitor prefers reduced motion) and swaps to the mobile crop below 768px. A single image just
 * renders as a still — no timer, no dots.
 */
export function HeroSlider({
  images,
  mobileImages,
  alt,
}: {
  images: string[]
  mobileImages: string[]
  alt: string
}) {
  const [index, setIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const slides = (isMobile && mobileImages.length ? mobileImages : images).filter(Boolean)

  useEffect(() => {
    if (slides.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % slides.length)
    }, 6000)
    return () => clearInterval(id)
  }, [slides.length])

  if (!slides.length) return null
  const active = index % slides.length

  return (
    <div className="hero-slider">
      {slides.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src + i}
          src={src}
          alt={i === 0 ? alt : ''}
          className={`hero-slide${i === active ? ' is-active' : ''}`}
          loading={i === 0 ? 'eager' : 'lazy'}
          // The first slide is the LCP element on most pages.
          fetchPriority={i === 0 ? 'high' : 'auto'}
        />
      ))}
      {slides.length > 1 && (
        <div className="hero-dots" role="tablist" aria-label="Slides">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Slide ${i + 1}`}
              className={`hero-dot${i === active ? ' is-active' : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
