import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { BlogPage, VillaPage } from '@/components/sections'
import { Shell } from '@/components/Shell'
import { getBlog, getBlogSlugs } from '@/content/blogs'
import { buildCtx, type SearchParams } from '@/content/ctx'
import { findPageSlugByKind } from '@/content/pages'
import { getVilla, getVillaSlugs } from '@/content/villas'
import { activeLocales } from '@/lib/i18n'
import { metadataFrom } from '@/lib/seo'

/**
 * Detail pages of the two collections, NESTED under their own hub — exactly the URL structure the
 * previous site had, so every indexed URL keeps working without a redirect:
 *   nl  /villa-s/villa-zee        de  /ferienhauser/villa-zee
 *   nl  /blogs/fietsen-op-ameland de  /blogs/ameland-saisonfuhrer
 *
 * The hub segment is NOT a folder in the route tree, because its slug differs per language
 * (`villa-s` vs `ferienhauser`). It is the `pages.json` key whose `kind` is `villas-hub` /
 * `blogs-hub`, so `[slug]` is validated against that at render time instead of being hardcoded —
 * renaming a hub in the CMS moves its detail pages along with it.
 *
 * Depth 1 (`../page.tsx`) still serves every flat page: the hubs themselves, contact, voorwaarden,
 * landingspagina's. Both routes use `[slug]` for the first segment because Next requires one name
 * per position in the tree.
 */

/** Which collection this first segment addresses in this language — undefined if it is not a hub. */
function collectionFor(locale: string, slug: string): 'villas' | 'blogs' | undefined {
  if (slug === findPageSlugByKind(locale, 'villas-hub')) return 'villas'
  if (slug === findPageSlugByKind(locale, 'blogs-hub')) return 'blogs'
  return undefined
}

export function generateStaticParams() {
  const out: { locale: string; slug: string; item: string }[] = []
  for (const locale of activeLocales()) {
    for (const [kind, label, slugs] of [
      ['villas-hub', 'villa', getVillaSlugs(locale)],
      ['blogs-hub', 'blog', getBlogSlugs(locale)],
    ] as const) {
      const hub = findPageSlugByKind(locale, kind)
      // No hub page means these detail pages would have no URL at all — louder as a build error
      // than as 92 silent 404s.
      if (!hub) {
        if (slugs.length === 0) continue
        throw new Error(`[nested] ${locale} heeft geen ${kind}-pagina, dus ${slugs.length} ${label}-pagina's hebben geen URL`)
      }
      const seen = new Set<string>()
      for (const slug of slugs) {
        if (seen.has(slug)) throw new Error(`[nested] dubbele ${label}-slug "${slug}" onder /${hub} (${locale})`)
        seen.add(slug)
        out.push({ locale, slug: hub, item: slug })
      }
    }
  }
  return out
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string; item: string }> }): Promise<Metadata> {
  const { locale, slug, item } = await params
  const source = collectionFor(locale, slug)
  if (source === 'villas') {
    const villa = getVilla(locale, item)
    if (villa) return metadataFrom(villa.seo, villa.title)
  }
  if (source === 'blogs') {
    const blog = getBlog(locale, item)
    if (blog) return metadataFrom(blog.seo, blog.title)
  }
  return {}
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string; item: string }>
  searchParams: Promise<SearchParams>
}) {
  const { locale, slug, item } = await params
  const source = collectionFor(locale, slug)
  if (!source) notFound() // a two-segment URL whose first segment isn't a hub
  // A villa reached from Zoek & boek carries the search in its query, so its booking calendar can
  // open on the period and party the guest already chose.
  const ctx = await buildCtx(locale, await searchParams)

  if (source === 'villas') {
    const villa = getVilla(locale, item)
    if (villa) return <Shell locale={locale}><VillaPage villa={villa} ctx={ctx} /></Shell>
  } else {
    const blog = getBlog(locale, item)
    if (blog) return <Shell locale={locale}><BlogPage blog={blog} ctx={ctx} /></Shell>
  }

  notFound()
}
