import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/Breadcrumb'
import { JsonLd } from '@/components/JsonLd'
import { BlogPage, VillaPage } from '@/components/sections'
import { Shell } from '@/components/Shell'
import { getBlog, getBlogSlugs } from '@/content/blogs'
import { itemTrail } from '@/content/breadcrumbs'
import { buildCtx } from '@/content/ctx'
import { itemEquivalents } from '@/content/equivalents'
import { findPageSlugByKind } from '@/content/pages'
import { getSite } from '@/content/site'
import { getVilla, getVillaSlugs } from '@/content/villas'
import { activeLocales } from '@/lib/i18n'
import { blogPosting, breadcrumbList, graph, vacationRental } from '@/lib/jsonld'
import { ogImageForBlog, ogImageForVilla } from '@/lib/og-image'
import { metadataFrom } from '@/lib/seo'
import { t } from '@/lib/ui-text'

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
  if (!source) return {}
  // Villas exist in both languages (matched by slug or the verified alias table); most articles exist
  // in one language only and correctly end up with a canonical but no hreflang.
  const identity = { locale, equivalents: itemEquivalents(locale, item, source) }
  if (source === 'villas') {
    const villa = getVilla(locale, item)
    if (villa) return metadataFrom(villa.seo, villa.title, identity, ogImageForVilla(villa))
  } else {
    const blog = getBlog(locale, item)
    if (blog) return metadataFrom(blog.seo, blog.title, identity, ogImageForBlog(blog))
  }
  return {}
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string; item: string }> }) {
  const { locale, slug, item } = await params
  const source = collectionFor(locale, slug)
  if (!source) notFound() // a two-segment URL whose first segment isn't a hub
  const ctx = buildCtx(locale)
  const site = getSite(locale)

  // Home › Hub › Item, from the same content the pages render — so the visible trail and the
  // BreadcrumbList JSON-LD are guaranteed identical.
  const trail = itemTrail(locale, slug, item, source, site.brandName)
  const path = `/${slug}/${item}`
  const label = t(locale, 'breadcrumb')

  if (source === 'villas') {
    const villa = getVilla(locale, item)
    if (villa) {
      // VacationRental facts come from this villa's own text via `villaFacts` — never inferred.
      const jsonld = graph([vacationRental(locale, item, villa, path, site), breadcrumbList(locale, trail)])
      return (
        <Shell locale={locale}>
          <JsonLd json={jsonld} />
          {/* Villa pages open with a hero photo, so the trail sits on the image. */}
          <VillaPage villa={villa} ctx={ctx} crumbs={<Breadcrumb trail={trail} label={label} variant="onImage" />} />
        </Shell>
      )
    }
  } else {
    const blog = getBlog(locale, item)
    if (blog) {
      // No author/date: the content model has none — see `blogPosting`.
      const jsonld = graph([blogPosting(locale, blog, path), breadcrumbList(locale, trail)])
      return (
        <Shell locale={locale}>
          <JsonLd json={jsonld} />
          {/* Articles have no hero image — the trail renders on the light background. */}
          <BlogPage blog={blog} ctx={ctx} crumbs={<Breadcrumb trail={trail} label={label} />} />
        </Shell>
      )
    }
  }

  notFound()
}
