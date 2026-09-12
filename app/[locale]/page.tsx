import type { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'
import { Sections, type SectionOpts } from '@/components/sections'
import { Shell } from '@/components/Shell'
import { buildCtx } from '@/content/ctx'
import { homeEquivalents } from '@/content/equivalents'
import { getHome } from '@/content/home'
import { getSite } from '@/content/site'
import { graph, organization, website } from '@/lib/jsonld'
import { ogImageForPage } from '@/lib/og-image'
import { pageHeading } from '@/lib/page-heading'
import { metadataFrom } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const site = getSite(locale)
  const home = getHome(locale)
  // The homepage exists in every language, so it always gets a canonical + reciprocal hreflang.
  return metadataFrom(
    home.seo,
    `${site.brandName} — ${site.tagline}`,
    { locale, equivalents: homeEquivalents() },
    ogImageForPage(home.seo?.ogImage, home.sections),
  )
}

/** Homepage. Like every other page it is just a list of sections from content/<locale>/home.json. */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const home = getHome(locale)
  const site = getSite(locale)

  /**
   * The homepage's first hero already carries the real page heading ("Geniet van luxe en weelde op
   * Ameland" / its German equivalent) but renders it as a <p>, leaving the homepage without an h1.
   * Promote that existing text to the <h1>; no content changes.
   *
   * `home.json` has a SECOND hero further down. `pageHeading` returns the first hero's index, so only
   * that one becomes the h1 — the lower hero keeps its <p> and the page has exactly one.
   * No breadcrumb here: the homepage is the root, and a one-crumb trail is not a trail.
   */
  const heading = pageHeading(home.sections, `${site.brandName} — ${site.tagline}`)
  const opts: Record<number, SectionOpts> = {}
  if (heading.heroIndex >= 0 && heading.text) opts[heading.heroIndex] = { heading: true }
  else if (heading.fromSection >= 0) opts[heading.fromSection] = { headingLevel: 1 }

  const sections = [...home.sections]
  // Only inject when the hero has no title of its own (it normally does).
  if (heading.heroIndex >= 0 && heading.text) {
    const hero = sections[heading.heroIndex]
    if (hero.type === 'hero' && !hero.title.trim()) sections[heading.heroIndex] = { ...hero, title: heading.text }
    if (heading.fromSection >= 0) opts[heading.fromSection] = { suppressTitle: true }
  }

  // Organization + WebSite are declared once, on the homepage, and referenced by @id from every
  // other page's structured data — so the business facts live in exactly one place.
  const jsonld = graph([organization(locale, site), website(locale, site)])
  return (
    <Shell locale={locale}>
      <JsonLd json={jsonld} />
      <Sections sections={sections} ctx={await buildCtx(locale)} opts={opts} />
    </Shell>
  )
}
