'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import type { NavItem } from '@/lib/types'

import { LanguageSwitcher } from './LanguageSwitcher'
import { LocaleLink } from './LocaleLink'

/** Hamburger + full-height drawer holding the complete nav (the desktop header may collapse part of
 *  it into a "Meer" menu; the drawer never does). Client component, same site.json nav data. */
export function MobileMenu({
  nav,
  ctaLabel,
  ctaUrl,
  locales,
}: {
  nav: NavItem[]
  ctaLabel: string
  ctaUrl: string
  locales?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const close = () => setOpen(false)

  // The drawer is portalled to <body>, which only exists on the client — so it may not render until
  // after hydration. See the portal below for why it cannot stay inside the header.
  useEffect(() => setMounted(true), [])

  // Lock body scroll while the drawer is open so the page can't scroll behind it.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <div className="mobilenav">
      <button
        className="hamburger"
        aria-label={open ? 'Menu sluiten' : 'Menu openen'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span /><span /><span />
      </button>

      {/* The drawer is rendered into <body>, not here.
        *
        * `.header` sets `backdrop-filter`, which makes it a stacking context: every descendant is
        * then painted inside the header's own layer, and no z-index on the drawer can lift it above
        * the header's logo and buttons. Portalling it out of that subtree is what keeps the open
        * menu over the whole page instead of sliding in behind the header. */}
      {mounted && createPortal(
        <>
          {open && <div className="drawer-overlay" onClick={close} />}

          <aside className={`drawer${open ? ' is-open' : ''}`} aria-hidden={!open}>
            <div className="drawer-head">
              <span className="drawer-title">Menu</span>
              <button className="drawer-close" aria-label="Sluiten" onClick={close}>&times;</button>
            </div>
            <nav className="drawer-nav">
              {nav.map((item) => (
                <div className="drawer-group" key={item.label}>
                  <LocaleLink className="drawer-link" href={item.url} onClick={close}>{item.label}</LocaleLink>
                </div>
              ))}
            </nav>
            {locales && locales.length > 1 && (
              <div className="drawer-lang">
                <span className="drawer-sub-head">Taal / Language</span>
                <LanguageSwitcher locales={locales} variant="mobile" />
              </div>
            )}
            <LocaleLink className="btn btn-primary drawer-cta" href={ctaUrl} onClick={close}>{ctaLabel}</LocaleLink>
          </aside>
        </>,
        document.body,
      )}
    </div>
  )
}
