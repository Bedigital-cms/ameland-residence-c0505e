import type { Metadata } from 'next'

import { findPageSlugByKind, getPageSlugs } from '@/content/pages'
import { getVilla, getVillaSlugs } from '@/content/villas'
import { activeLocales, canonicalOriginForLocale, defaultLocale } from './i18n'

/**
 * Canonical + hreflang for one page, as production `alternates` metadata.
 *
 * Rules (Next.js: a page's `alternates` REPLACES an inherited one, so canonical AND languages are
 * always emitted together):
 *  - canonical = the page's OWN absolute, prefix-free production URL (per-domain www host).
 *  - languages = every locale that has a RELIABLE counterpart of THIS page, plus x-default → the
 *    default language's URL. Self is always included (self-reference).
 *  - Counterparts are only emitted when they are truthful — never guessed:
 *      · home        → both languages (`/`).
 *      · villa detail→ matched across languages by shared Tommy id (same physical villa); the hub
 *                      slug per language comes from the CMS (`villa-s` / `ferienhauser`).
 *      · flat page   → only when the SAME slug exists in the other language (shared-slug pages).
 *      · blog / page → otherwise self + x-default only (no fabricated translation).
 */

export type PageAlternates = NonNullable<Metadata['alternates']>

function absUrl(locale: string, path: string): string | null {
  const origin = canonicalOriginForLocale(locale)
  if (!origin) return null
  return path === '/' ? `${origin}/` : `${origin}${path.startsWith('/') ? path : `/${path}`}`
}

/** Build `alternates` from a per-locale path map (a locale is only linked when it has a path). */
function buildAlternates(currentLocale: string, pathByLocale: Record<string, string>): PageAlternates | undefined {
  const canonical = absUrl(currentLocale, pathByLocale[currentLocale] ?? '/')
  if (!canonical) return undefined

  const languages: Record<string, string> = {}
  for (const locale of activeLocales()) {
    const path = pathByLocale[locale]
    if (!path) continue
    const url = absUrl(locale, path)
    if (url) languages[locale] = url
  }

  const def = defaultLocale()
  const xDefault = pathByLocale[def] ? absUrl(def, pathByLocale[def]) : canonical
  if (xDefault) languages['x-default'] = xDefault

  return { canonical, languages }
}

export function homeAlternates(locale: string): PageAlternates | undefined {
  const pathByLocale: Record<string, string> = {}
  for (const l of activeLocales()) pathByLocale[l] = '/'
  return buildAlternates(locale, pathByLocale)
}

export function villaAlternates(locale: string, item: string): PageAlternates | undefined {
  const tommyId = getVilla(locale, item)?.tommyId
  const pathByLocale: Record<string, string> = {}
  for (const l of activeLocales()) {
    const hub = findPageSlugByKind(l, 'villas-hub')
    if (!hub) continue
    if (l === locale) {
      pathByLocale[l] = `/${hub}/${item}`
      continue
    }
    // Same physical villa in the other language = same Tommy id (never a slug guess).
    const counterpart = tommyId ? getVillaSlugs(l).find((s) => getVilla(l, s)?.tommyId === tommyId) : undefined
    if (counterpart) pathByLocale[l] = `/${hub}/${counterpart}`
  }
  return buildAlternates(locale, pathByLocale)
}

export function pageAlternates(locale: string, slug: string): PageAlternates | undefined {
  const pathByLocale: Record<string, string> = { [locale]: `/${slug}` }
  for (const l of activeLocales()) {
    if (l === locale) continue
    // Only a shared slug is a reliable counterpart; differing slugs have no explicit mapping.
    if (getPageSlugs(l).includes(slug)) pathByLocale[l] = `/${slug}`
  }
  return buildAlternates(locale, pathByLocale)
}

export function blogAlternates(locale: string, item: string): PageAlternates | undefined {
  const hub = findPageSlugByKind(locale, 'blogs-hub') ?? 'blogs'
  // Blog slugs differ per language with no reliable mapping → self + x-default only.
  return buildAlternates(locale, { [locale]: `/${hub}/${item}` })
}

/** Absolute canonical URL for the current page (for og:url), or undefined. */
export function canonicalUrlOf(alternates: PageAlternates | undefined): string | undefined {
  const c = alternates?.canonical
  return typeof c === 'string' ? c : undefined
}
