/**
 * Build a locale-prefixed href from a plain content URL.
 *
 * Content JSON stores URLs WITHOUT a locale prefix (e.g. "/behandelingen/combi-brows"). At render
 * time we prepend the active locale so links point at the right language: "/nl/behandelingen/...".
 * External URLs, anchors (#...), mailto:/tel:, and already-prefixed paths are returned unchanged.
 *
 * This module is PURE (no fs) so it is safe to import from client components — the i18n config
 * (default locale + hide-prefix) is passed in via `opts`, never read here.
 */
import { isSupportedLocale } from './locales'

/** i18n options for link-building — sourced from lib/i18n on the server, passed down via context. */
export type LocaleHrefOpts = { defaultLocale?: string; hideDefaultPrefix?: boolean }

/** True for an on-site path we should localise ("/foo"), false for external/anchor/mailto/tel. */
export function isInternalPath(url: string): boolean {
  if (!url) return false
  return url.startsWith('/') && !url.startsWith('//')
}

/** Whether a path already begins with a "/<supported-locale>" segment. */
function hasLocalePrefix(url: string): boolean {
  const seg = url.split('/')[1] // "/nl/x" -> "nl"
  return !!seg && isSupportedLocale(seg)
}

/**
 * Prefix an internal URL with `/<locale>`. Leaves external links, anchors, mailto:/tel:, and
 * already-localised paths untouched. Root "/" becomes "/<locale>".
 *
 * When `opts.hideDefaultPrefix` is on and `locale` is the default, the URL is returned UNPREFIXED
 * (content URLs are already prefix-free) — the proxy serves those clean URLs from the default
 * language. Every other language always gets its "/<locale>" prefix.
 */
export function localeHref(locale: string, url: string, opts?: LocaleHrefOpts): string {
  if (!isInternalPath(url)) return url
  if (hasLocalePrefix(url)) return url
  if (opts?.hideDefaultPrefix && opts.defaultLocale && locale === opts.defaultLocale) return url
  if (url === '/') return `/${locale}`
  return `/${locale}${url}`
}
