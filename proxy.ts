import { NextResponse, type NextRequest } from 'next/server'

import { activeLocales, defaultLocale, hideDefaultPrefix, localeForHost } from '@/lib/i18n'

/**
 * Locale routing proxy (formerly the `middleware` file convention, renamed in Next 16).
 *
 * Every page lives under /[locale]/…, but visitors hit unprefixed URLs ("/", "/behandelingen").
 *
 * THREE modes:
 *
 *  0) PER-DOMAIN locale (content/i18n.json → domainLocalesEnabled + domainLocales, CMS toggle):
 *     when the request HOST maps to a language (e.g. casabase.nl → nl, casabase.de → de), that
 *     domain serves ONE language on clean, prefix-free URLs. Takes precedence over A/B below:
 *       /behandelingen        → REWRITE to /<host-locale>/behandelingen (URL stays clean)
 *       /<any-locale>/…       → 301 REDIRECT to the clean path (the domain forces its own language,
 *                               so a stray /<locale> prefix is canonicalised away)
 *     A host NOT in the map (preview/staging) falls through to mode A/B unchanged.
 *
 *  A) hideDefaultPrefix = false (classic — every language prefixed):
 *       /              → redirect /<default>
 *       /behandelingen → redirect /<default>/behandelingen
 *       /<locale>/…    → pass through
 *
 *  B) hideDefaultPrefix = true (clean URLs for the default language — "as-needed" prefix):
 *       /behandelingen        → REWRITE to /<default>/behandelingen (URL stays clean)
 *       /<default>/behandelingen → 301 REDIRECT to /behandelingen (canonical, no duplicate content)
 *       /<other-locale>/…     → pass through (non-default keeps its prefix)
 *
 * `content/i18n.json` is read via lib/i18n (fs) — fine in the proxy (Node runtime).
 */
// The proxy convention always runs on the Node.js runtime, so we can read content/i18n.json from
// the filesystem directly — no `runtime` export needed (and it's disallowed here).
export const config = {
  // Skip Next internals, the media route, and anything with a file extension (static assets).
  matcher: ['/((?!_next/|api/|media/|.*\\..*).*)'],
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const locales = activeLocales()
  const def = defaultLocale()
  const first = pathname.split('/')[1]
  const hasLocale = locales.includes(first)

  // Mode 0 — per-domain locale: the host decides the language, served on clean URLs.
  const hostLocale = localeForHost(req.headers.get('host'))
  if (hostLocale) {
    if (hasLocale) {
      // A locale prefix on a per-domain host is non-canonical → strip it (301 to the clean path).
      const rest = pathname.slice(`/${first}`.length) || '/'
      const url = req.nextUrl.clone()
      url.pathname = rest
      return NextResponse.redirect(url, 301)
    }
    // Unprefixed path → serve the host's language WITHOUT changing the URL (internal rewrite).
    const url = req.nextUrl.clone()
    url.pathname = pathname === '/' ? `/${hostLocale}` : `/${hostLocale}${pathname}`
    return NextResponse.rewrite(url)
  }

  if (hideDefaultPrefix()) {
    // Mode B — the default language lives on clean, prefix-free URLs.
    if (first === def) {
      // Strip the default prefix → 301 to the canonical clean URL (/<default>/x → /x, /<default> → /).
      const rest = pathname.slice(`/${def}`.length) || '/'
      const url = req.nextUrl.clone()
      url.pathname = rest
      return NextResponse.redirect(url, 301)
    }
    if (hasLocale) return NextResponse.next() // a non-default active locale keeps its prefix
    // Unprefixed path → serve the default language WITHOUT changing the URL (internal rewrite).
    const url = req.nextUrl.clone()
    url.pathname = pathname === '/' ? `/${def}` : `/${def}${pathname}`
    return NextResponse.rewrite(url)
  }

  // Mode A — every language (incl. the default) is prefixed.
  if (hasLocale) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = pathname === '/' ? `/${def}` : `/${def}${pathname}`
  // Temporary redirect so toggling i18n later isn't cached hard.
  return NextResponse.redirect(url)
}
