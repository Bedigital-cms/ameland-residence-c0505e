import type { PageCollection, PageContent } from '@/lib/types'

import { loadContent } from './load'

/** slug → page, for one language. Holds both plain content pages and the fixed functional pages
 *  (villa overview, blog overview, Zoek & boek, last minutes, contact, sitemap) — see `PageKind`. */
export function getPages(locale: string): PageCollection {
  return loadContent<PageCollection>('pages', locale)
}

/** Every page slug in this language — feeds `generateStaticParams`. */
export function getPageSlugs(locale: string): string[] {
  return Object.keys(getPages(locale))
}

export function getPage(locale: string, slug: string): PageContent | undefined {
  return getPages(locale)[slug]
}

/** The slug of the page with a given `kind` (e.g. the villa hub: "villa-s" in nl, "ferienhauser" in
 *  de). Used for cross-links that must land on the right page in each language. */
export function findPageSlugByKind(locale: string, kind: PageContent['kind']): string | undefined {
  return Object.entries(getPages(locale)).find(([, p]) => p.kind === kind)?.[0]
}

/**
 * URL base for a collection's detail pages: they sit UNDER their hub ("/villa-s" in nl,
 * "/ferienhauser" in de, "/blogs" in both), matching the previous site's structure.
 *
 * Every villa/article link is built from this, so the base is defined in exactly one place. Returns
 * "" when the hub page is missing, which degrades links to a flat "/<slug>" instead of producing a
 * broken "/undefined/<slug>" (the build guard in `[slug]/[item]` reports the missing hub).
 */
export function hubBase(locale: string, kind: 'villas-hub' | 'blogs-hub'): string {
  const slug = findPageSlugByKind(locale, kind)
  return slug ? `/${slug}` : ''
}
