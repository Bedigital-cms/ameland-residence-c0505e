import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/Breadcrumb'
import { JsonLd } from '@/components/JsonLd'
import { Sections, type RenderCtx, type SectionOpts } from '@/components/sections'
import { Shell } from '@/components/Shell'
import { pageTrail } from '@/content/breadcrumbs'
import { buildCtx, type SearchParams } from '@/content/ctx'
import { pageEquivalents } from '@/content/equivalents'
import { getPage, getPageSlugs } from '@/content/pages'
import { getSite } from '@/content/site'
import { activeLocales } from '@/lib/i18n'
import { breadcrumbList, graph } from '@/lib/jsonld'
import { ogImageForPage } from '@/lib/og-image'
import { pageHeading } from '@/lib/page-heading'
import { metadataFrom } from '@/lib/seo'
import type { PageContent, Section, TextSection } from '@/lib/types'
import { t } from '@/lib/ui-text'

/**
 * Every PAGE on this site except the homepage: the hubs (`/villa-s`, `/blogs`), the functional
 * pages (`/contact`, `/zoek-boek`, `/sitemap`) and all landing/info pages (`/over-ons`,
 * `/algemene-voorwaarden`). One route, one JSON key per page — adding a page never touches code.
 *
 * Villa and article DETAIL pages are not here: they are nested under their hub
 * (`/villa-s/villa-zee`, `/blogs/fietsen-op-ameland`) and live in `[item]/page.tsx`, which is the
 * URL structure the previous site used.
 *
 * Because every language has its OWN slugs (nl `/villa-s`, de `/ferienhauser`), the functional
 * pages can't be static folders in the route tree. Instead each entry in `pages.json` carries a
 * `kind` that says what it does — see `renderPage` below.
 */

/** Reserved first path segments that must never be used as a page slug. `media` is a real
 *  route (app/media/[filename]); the locale codes are the routing prefixes themselves. */
const RESERVED = new Set(['media', 'api', '_next', ...activeLocales()])

export function generateStaticParams() {
  const out: { locale: string; slug: string }[] = []
  for (const locale of activeLocales()) {
    for (const slug of getPageSlugs(locale)) {
      if (RESERVED.has(slug)) throw new Error(`[pages] slug "${slug}" (${locale}) botst met een vaste route`)
      out.push({ locale, slug })
    }
  }
  return out
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params
  const page = getPage(locale, slug)
  if (!page) return {}
  return metadataFrom(
    page.seo,
    page.title,
    { locale, equivalents: pageEquivalents(locale, slug) },
    // `page.sections`, not the `kind`-expanded list: the sections added there (the search results,
    // the generated sitemap, the contact form) carry no photograph, so searching them would find
    // nothing while making the share image depend on rendering logic rather than editable content.
    ogImageForPage(page.seo?.ogImage, page.sections),
  )
}

/**
 * Render a `pages.json` entry according to its `kind`. Most kinds only ADD a section to whatever the
 * page already has — the contact page gets the form, the sitemap page gets the generated index —
 * so the editable content stays in charge of the rest of the layout.
 */
function pageSections(page: PageContent): Section[] {
  const sections: Section[] = [...page.sections]
  const has = (type: Section['type']) => sections.some((s) => s.type === type)

  switch (page.kind) {
    case 'villas-hub':
      if (!has('collection')) sections.push({ type: 'collection', source: 'villas', title: page.title, linkLabel: '' })
      break
    case 'blogs-hub':
      if (!has('collection')) sections.push({ type: 'collection', source: 'blogs', title: page.title, linkLabel: '' })
      break
    case 'booking': {
      // The results block carries the search controls in its own sidebar, so the page's plain
      // `booking` section is replaced rather than kept — otherwise the same period and party
      // dropdowns would appear twice, once above the results and once beside them.
      if (has('searchResults')) break
      const at = sections.findIndex((s) => s.type === 'booking')
      if (at === -1) sections.push({ type: 'searchResults' })
      else sections.splice(at, 1, { type: 'searchResults' })
      break
    }
    case 'lastminutes': {
      if (has('lastminutes')) break
      // The overview carries its own period filter AND the villa results, so it takes the place of
      // the plain search widget the page's JSON asks for — two calendars on one page would only
      // compete. Without such a section it simply goes at the end.
      const at = sections.findIndex((s) => s.type === 'booking')
      if (at === -1) sections.push({ type: 'lastminutes' })
      else sections.splice(at, 1, { type: 'lastminutes' })
      break
    }
    case 'contact': {
      if (has('form')) break
      // Move the page's own contact copy into the form's info column rather than appending a
      // second block — otherwise the address is printed twice, once by each.
      const lastText = sections.map((s, i) => [s, i] as const).reverse().find(([s]) => s.type === 'text')
      const intro = lastText ? (sections.splice(lastText[1], 1)[0] as TextSection) : undefined
      sections.push({ type: 'form', slug: 'contact', intro })
      break
    }
    case 'sitemap':
      if (!has('sitemap')) sections.push({ type: 'sitemap' })
      break
    default:
      break
  }
  return sections
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { locale, slug } = await params
  const page = getPage(locale, slug)
  if (!page) notFound()

  // The Zoek & boek page is addressed by `?range=`, so the query is part of what it renders.
  const ctx: RenderCtx = await buildCtx(locale, await searchParams)
  const site = getSite(locale)
  const sections = pageSections(page)

  /**
   * Give the page exactly one <h1>.
   *
   * Every `pages.json` hero stores `title: ""` and `HeroBlock` renders its title as a <p>, so these
   * pages shipped with NO h1 and a heading tree starting at <h2>. `pageHeading` recovers the heading
   * the page ALREADY displays — no new copy — and renders it as the <h1> in the hero, suppressing the
   * now-duplicate heading at its old position.
   *
   * It runs on the FINAL section list (after `pageSections`), so it sees the sections that actually
   * render. That matters for the contact page, where the text section moves inside the form: it is no
   * longer a top-level section, so the page falls through to its own title instead.
   */
  const heading = pageHeading(sections, page.title)
  const crumbLabel = t(locale, 'breadcrumb')
  // The trail names this page by its H1, not by its SEO title (which carries a "| brand" suffix).
  const trail = pageTrail(locale, slug, site.brandName, heading.text)

  const opts: Record<number, SectionOpts> = {}
  const hasHeroH1 = heading.heroIndex >= 0 && !!heading.text

  if (hasHeroH1) {
    // Promote into the hero: inject the text as the hero title, mark it as the h1, add the crumbs.
    const hero = sections[heading.heroIndex]
    if (hero.type === 'hero' && !hero.title.trim()) {
      sections[heading.heroIndex] = { ...hero, title: heading.text }
    }
    opts[heading.heroIndex] = {
      heading: true,
      crumbs: <Breadcrumb trail={trail} label={crumbLabel} variant="onImage" />,
    }
    // Only suppress the old location when the hero took ITS text (not when the hero had its own).
    if (heading.fromSection >= 0) opts[heading.fromSection] = { suppressTitle: true }
  } else if (heading.fromSection >= 0) {
    // No hero on this page — the existing section heading becomes the h1 where it already sits.
    opts[heading.fromSection] = { headingLevel: 1 }
  } else if (heading.text) {
    /**
     * No hero AND no section carrying a heading — the booking pages (`/zoek-boek`,
     * `/suchen-buchen`) are just an empty text section plus the results block. Give the page its
     * heading by filling that empty text section's title with the page's own title, so the h1 lands
     * above the results instead of nowhere.
     */
    const target = sections.findIndex((s) => s.type === 'text' || s.type === 'textImage')
    if (target >= 0) {
      const sec = sections[target]
      if ((sec.type === 'text' || sec.type === 'textImage') && !sec.title.trim()) {
        sections[target] = { ...sec, title: heading.text }
      }
      opts[target] = { headingLevel: 1 }
    }
  }

  const jsonld = graph([breadcrumbList(locale, trail)])

  return (
    <Shell locale={locale}>
      <JsonLd json={jsonld} />
      {/* Pages without a hero image show the trail on the light background, above the content. */}
      {!hasHeroH1 && trail.length > 1 && (
        <div className="container crumbs--standalone">
          <Breadcrumb trail={trail} label={crumbLabel} />
        </div>
      )}
      <Sections sections={sections} ctx={ctx} opts={opts} />
    </Shell>
  )
}
