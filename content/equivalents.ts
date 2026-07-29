/**
 * Cross-language page equivalence — which Dutch page is the same page as which German one.
 *
 * hreflang must only connect GENUINE equivalents, and this site makes that non-trivial in three ways:
 *
 *  1. Functional pages have different slugs per language (`/villa-s` vs `/ferienhauser`). They are
 *     the same page, so they are matched by their `kind`, not their slug.
 *  2. Collection items are keyed by slug and USUALLY identical across languages (`villa-zee`), but
 *     not always — the bungalow is `luxe-bungalow-watersnip` in nl and `luxesbungalow-watersnip`
 *     in de. Matching on slug alone would silently drop that pair.
 *  3. Counts differ (57 nl articles vs 25 de). Most articles exist in one language only and must
 *     get NO hreflang rather than a link to an unrelated page.
 *
 * Every function here returns a locale → prefix-free-path map, ready for `alternatesFor`. A locale
 * missing from the map means "no genuine equivalent in that language".
 *
 * Server-only (reads content via the loaders).
 */
import { activeLocales } from '@/lib/i18n'

import { getBlogs } from './blogs'
import { findPageSlugByKind, getPage, getPages, hubBase } from './pages'
import { getVillas } from './villas'

/** The homepage exists in every active language, always at the root. */
export function homeEquivalents(): Record<string, string> {
  return Object.fromEntries(activeLocales().map((loc) => [loc, '/']))
}

/**
 * Equivalents for a `pages.json` entry.
 *
 * Functional pages (villa hub, blog hub, contact, …) are matched by `kind`, which survives the
 * per-language slug difference. Plain content pages carry no kind marker, so they are matched by
 * identical slug — with the German landing pages using their own slugs (`/ferienhaus-auf-ameland-
 * mieten`), a same-slug match is the only defensible signal that two pages are the same page.
 */
export function pageEquivalents(locale: string, slug: string): Record<string, string> {
  const page = getPage(locale, slug)
  if (!page) return {}
  const out: Record<string, string> = { [locale]: `/${slug}` }

  for (const loc of activeLocales()) {
    if (loc === locale) continue
    // A "page" kind is generic (most pages have it) so it cannot identify a counterpart — those
    // fall through to the slug match below.
    if (page.kind !== 'page') {
      const twin = findPageSlugByKind(loc, page.kind)
      if (twin) out[loc] = `/${twin}`
      continue
    }
    if (getPages(loc)[slug]) out[loc] = `/${slug}`
  }
  return out
}

/**
 * Equivalents for a collection item (villa or article), nested under each language's own hub:
 * nl `/villa-s/villa-zee` ↔ de `/ferienhauser/villa-zee`.
 *
 * `aliases` handles the hand-verified slug pairs that differ between languages. Only add a pair here
 * when the two entries are genuinely the same accommodation/article — this file is the one place
 * where such a claim is recorded, so it stays auditable.
 */
const VILLA_ALIASES: Record<string, string>[] = [{ nl: 'luxe-bungalow-watersnip', de: 'luxesbungalow-watersnip' }]

/** The slug this item uses in `target`, honouring the verified alias table. */
function aliasSlug(aliases: Record<string, string>[], locale: string, slug: string, target: string): string | undefined {
  const row = aliases.find((r) => r[locale] === slug)
  return row?.[target]
}

export function itemEquivalents(
  locale: string,
  slug: string,
  source: 'villas' | 'blogs',
): Record<string, string> {
  const kind = source === 'villas' ? 'villas-hub' : 'blogs-hub'
  const aliases = source === 'villas' ? VILLA_ALIASES : []
  const base = hubBase(locale, kind)
  if (!base) return {}
  const out: Record<string, string> = { [locale]: `${base}/${slug}` }

  for (const loc of activeLocales()) {
    if (loc === locale) continue
    const twinBase = hubBase(loc, kind)
    if (!twinBase) continue
    const items = source === 'villas' ? getVillas(loc) : getBlogs(loc)
    // Same slug, or a verified alias. No fuzzy/title matching: a wrong pair is worse than none.
    const twinSlug = items[slug] ? slug : aliasSlug(aliases, locale, slug, loc)
    if (twinSlug && items[twinSlug]) out[loc] = `${twinBase}/${twinSlug}`
  }
  return out
}
