import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Sections, type RenderCtx } from '@/components/sections'
import { Shell } from '@/components/Shell'
import { buildCtx, type SearchParams } from '@/content/ctx'
import { getPage, getPageSlugs } from '@/content/pages'
import { activeLocales } from '@/lib/i18n'
import { metadataFrom } from '@/lib/seo'
import type { PageContent, Section, TextSection } from '@/lib/types'

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
  return page ? metadataFrom(page.seo, page.title) : {}
}

/**
 * Render a `pages.json` entry according to its `kind`. Most kinds only ADD a section to whatever the
 * page already has — the contact page gets the form, the sitemap page gets the generated index —
 * so the editable content stays in charge of the rest of the layout.
 */
function renderPage(page: PageContent, ctx: RenderCtx) {
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
  return <Sections sections={sections} ctx={ctx} />
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
  return <Shell locale={locale}>{renderPage(page, await buildCtx(locale, await searchParams))}</Shell>
}
