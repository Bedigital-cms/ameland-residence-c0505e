/**
 * Breadcrumb trails, built from the same content the pages render.
 *
 * A trail is a list of `{ name, path }` crumbs from the homepage down to the current page, using
 * PREFIX-FREE paths (the shape stored in content); the renderer localises them via LocaleLink and
 * `lib/urls` turns them absolute for JSON-LD. Both the visible <Breadcrumb> and the
 * `BreadcrumbList` JSON-LD consume this one function, so they can never disagree — the task document
 * requires structured data to match visible content exactly.
 *
 * Names come from each page's own `title` in `pages.json` / `villas.json` / `blogs.json`. Nothing is
 * invented, and the hub crumb is looked up by `kind` so it reads "Villa's" in Dutch and
 * "Ferienhäuser" in German with its own per-language slug.
 *
 * Server-only (reads content via the loaders).
 */
import { pageHeading } from '@/lib/page-heading'

import { getBlog } from './blogs'
import { findPageSlugByKind, getPage, getPages } from './pages'
import { getVilla } from './villas'

export type Crumb = { name: string; path: string }

/** The root crumb — the brand name, which is what the site calls its own homepage in both
 *  languages. Avoids hardcoding an English "Home" or inventing a translated label. */
function homeCrumb(brandName: string): Crumb {
  return { name: brandName, path: '/' }
}

/**
 * Trail for a flat page from `pages.json`: Home › This page.
 *
 * `label` overrides the crumb text — pass the page's H1 so the trail reads "Over ons" rather than the
 * raw SEO title "Sinds 2009 luxe vakantievilla's op Ameland | Ameland Residence". A breadcrumb should
 * name the page the way the page names itself.
 */
export function pageTrail(locale: string, slug: string, brandName: string, label?: string): Crumb[] {
  const page = getPage(locale, slug)
  if (!page) return []
  return [homeCrumb(brandName), { name: label?.trim() || page.title, path: `/${slug}` }]
}

/**
 * Trail for a collection item: Home › Hub › Item.
 *
 * The hub crumb is the `pages.json` entry whose `kind` is `villas-hub` / `blogs-hub`, so it carries
 * that language's real slug and title. If the hub is missing the trail degrades to Home › Item
 * rather than inventing a segment.
 */
export function itemTrail(
  locale: string,
  hubSlug: string,
  item: string,
  source: 'villas' | 'blogs',
  brandName: string,
): Crumb[] {
  const trail: Crumb[] = [homeCrumb(brandName)]

  const kind = source === 'villas' ? 'villas-hub' : 'blogs-hub'
  const hub = findPageSlugByKind(locale, kind) ?? hubSlug
  const hubPage = hub ? getPages(locale)[hub] : undefined
  // The hub's `title` is its SEO title ("Luxe villa op Ameland huren | Ameland Residence"). In a trail
  // it must read as a short section name, so use the hub page's own H1 — the same heading the hub page
  // itself displays — and fall back to the stripped SEO title.
  if (hub && hubPage) {
    const hubHeading = pageHeading(hubPage.sections, hubPage.title)
    trail.push({ name: hubHeading.text || hubPage.title, path: `/${hub}` })
  }

  const entry = source === 'villas' ? getVilla(locale, item) : getBlog(locale, item)
  if (entry) trail.push({ name: entry.title, path: `/${hub}/${item}` })
  return trail
}
