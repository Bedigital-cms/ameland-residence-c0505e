'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import type { NavItem } from '@/lib/types'

import { LanguageSwitcher } from './LanguageSwitcher'
import { LocaleLink } from './LocaleLink'

/** Hamburger + full-height drawer holding the complete nav (the desktop header may collapse part of
 *  it into a "Meer" menu; the drawer never does). Client component, same site.json nav data.
 *
 *  De lade en het waas eronder hangen via een PORTAL onder <body>, niet in de header. Dat moet:
 *  `.header` heeft `backdrop-filter`, en dat maakt de header het containing block voor alles wat
 *  `position: fixed` is. Binnen de header werd `inset: 0` dus "de header vullen" (86px hoog) in
 *  plaats van het scherm, en de dichte lade schoof niet buiten beeld maar tot 88vw NAAST de header —
 *  wat de pagina horizontaal liet uitlopen. Buiten de header valt `fixed` weer terug op het
 *  viewport en dekt de lade het hele scherm, inclusief het logo. */
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
  // Portalen kan pas ná de eerste render: op de server bestaat `document` niet.
  const [mounted, setMounted] = useState(false)
  const close = () => setOpen(false)

  useEffect(() => setMounted(true), [])

  // Lock body scroll while the drawer is open so the page can't scroll behind it.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Escape sluit de lade — hij bedekt nu het hele scherm, dus er is geen zichtbaar stuk pagina meer
  // om naast te tikken.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const panel = (
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
    </>
  )

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

      {mounted ? createPortal(panel, document.body) : null}
    </div>
  )
}
