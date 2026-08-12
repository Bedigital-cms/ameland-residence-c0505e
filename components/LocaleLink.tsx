'use client'

import Link from 'next/link'
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react'

import { localeHref, isInternalPath } from '@/lib/href'

/**
 * Locale plumbing for links. A single <LocaleProvider locale> near the top of each page puts the
 * active locale in context; every <LocaleLink> below reads it and prefixes internal hrefs with
 * "/<locale>". This avoids threading `locale` through every component that renders a link.
 *
 * Content JSON keeps URLs prefix-free ("/behandelingen"); the prefix is applied only at render.
 */
/** Locale plus the routing config links need (default locale + whether its prefix is hidden). */
type LocaleCtx = { locale: string; defaultLocale: string; hideDefaultPrefix: boolean }
const LocaleContext = createContext<LocaleCtx>({ locale: 'nl', defaultLocale: 'nl', hideDefaultPrefix: false })

export function LocaleProvider({
  locale,
  defaultLocale,
  hideDefaultPrefix = false,
  children,
}: {
  locale: string
  /** Site default locale (from lib/i18n). Defaults to `locale` when not supplied. */
  defaultLocale?: string
  /** Whether the default locale is served without its /<locale> prefix (from lib/i18n). */
  hideDefaultPrefix?: boolean
  children: ReactNode
}) {
  return (
    <LocaleContext.Provider value={{ locale, defaultLocale: defaultLocale ?? locale, hideDefaultPrefix }}>
      {children}
    </LocaleContext.Provider>
  )
}

/** Read the current locale from context (defaults to "nl" if no provider — single-locale sites). */
export function useLocale(): string {
  return useContext(LocaleContext).locale
}

/** Read the full locale routing config (locale + defaultLocale + hideDefaultPrefix). */
export function useLocaleConfig(): LocaleCtx {
  return useContext(LocaleContext)
}

/**
 * Drop-in replacement for next/link that localises internal hrefs. External URLs, anchors and
 * mailto:/tel: pass through unchanged (rendered as a plain <a> so target/rel etc. still work).
 */
export function LocaleLink({ href, children, ...rest }: ComponentProps<typeof Link>) {
  const { locale, defaultLocale, hideDefaultPrefix } = useLocaleConfig()
  const url = typeof href === 'string' ? href : ''
  if (url && !isInternalPath(url)) {
    return (
      <a href={url} {...(rest as ComponentProps<'a'>)}>
        {children}
      </a>
    )
  }
  return (
    <Link href={url ? localeHref(locale, url, { defaultLocale, hideDefaultPrefix }) : href} {...rest}>
      {children}
    </Link>
  )
}
