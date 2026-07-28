'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { localeMeta } from '@/lib/locales'

import { Flag } from './Flag'
import { useLocaleConfig } from './LocaleLink'

/**
 * Language switcher for the site header and mobile menu. Renders the active locales as
 * flag + native language name, linking to the SAME page in the other language (swaps the leading
 * "/<locale>" path segment). Hidden on single-language sites.
 *
 *  - variant="header": a compact dropdown (current flag + name, opens a menu).
 *  - variant="mobile": an inline row of options (fits the drawer, no popover).
 *
 * `locales` (active codes) comes from the server (Header passes activeLocales()).
 */
export function LanguageSwitcher({
  locales,
  variant = 'header',
}: {
  locales?: string[]
  variant?: 'header' | 'mobile'
}) {
  const { locale: current, defaultLocale, hideDefaultPrefix } = useLocaleConfig()
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!locales || locales.length < 2) return null

  // Build the same page's URL in `target`. First strip any leading active-locale segment to get the
  // prefix-free path, then re-apply the prefix — EXCEPT for the default language when its prefix is
  // hidden (then it stays clean). Works whether or not the current URL carries a prefix.
  const swap = (target: string) => {
    const parts = pathname.split('/')
    const bare = parts[1] && locales.includes(parts[1]) ? '/' + parts.slice(2).join('/') : pathname
    const clean = bare === '' ? '/' : bare
    if (hideDefaultPrefix && target === defaultLocale) return clean
    return clean === '/' ? `/${target}` : `/${target}${clean}`
  }

  const curMeta = localeMeta(current)

  // Mobile: a simple inline row inside the drawer (no popover).
  if (variant === 'mobile') {
    return (
      <div className="lang-switcher lang-switcher-mobile" aria-label="Taal / Language">
        {locales.map((code) => {
          const meta = localeMeta(code)
          const isCurrent = code === current
          return (
            <a
              key={code}
              className={`lang-option${isCurrent ? ' is-current' : ''}`}
              href={swap(code)}
              lang={code}
              aria-current={isCurrent ? 'true' : undefined}
            >
              <Flag country={meta?.country} className="lang-flag" />
              <span className="lang-name">{meta?.label || code}</span>
            </a>
          )
        })}
      </div>
    )
  }

  // Header: a compact dropdown.
  return (
    <div className="lang-switcher lang-switcher-header" data-open={open ? 'true' : 'false'} ref={ref}>
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Taal wijzigen / Change language"
        onClick={() => setOpen((v) => !v)}
      >
        {/* Compact: flag + short code only (the header is busy); full names live in the dropdown. */}
        <Flag country={curMeta?.country} className="lang-flag" />
        <span className="lang-code">{current.toUpperCase()}</span>
        <span className="lang-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="lang-menu" role="listbox">
          {locales.map((code) => {
            const meta = localeMeta(code)
            const isCurrent = code === current
            return (
              <a
                key={code}
                className={`lang-option${isCurrent ? ' is-current' : ''}`}
                href={swap(code)}
                lang={code}
                role="option"
                aria-selected={isCurrent}
              >
                <Flag country={meta?.country} className="lang-flag" />
                <span className="lang-name">{meta?.label || code}</span>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
