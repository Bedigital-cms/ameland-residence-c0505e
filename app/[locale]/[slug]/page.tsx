import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Sections, type RenderCtx } from '@/components/sections'
import { Shell } from '@/components/Shell'
import { buildCtx, type SearchParams } from '@/content/ctx'
import { getPage, getPageSlugs } from '@/content/pages'
import { cmsPointer } from '@/lib/cmsEdit'
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
 *
 * Each original section keeps its JSON Pointer (`/<slug>/sections/<i>`) even when the render list is
 * mutated, so Visual Editor annotations still address the real source file.
 */
function renderPage(page: PageContent, ctx: RenderCtx, slug: string) {
  const located: { section: Section; pointer: string | null }[] = page.sections.map((section, i) => ({
    section,
    pointer: cmsPointer(slug, 'sections', i),
  }))
  const has = (type: Section['type']) => located.some((l) => l.section.type === type)

  switch (page.kind) {
    case 'villas-hub':
      if (!has('collection')) located.push({ section: { type: 'collection', source: 'villas', title: page.title, linkLabel: '' }, pointer: null })
      break
    case 'blogs-hub':
      if (!has('collection')) located.push({ section: { type: 'collection', source: 'blogs', title: page.title, linkLabel: '' }, pointer: null })
      break
    case 'booking': {
      // The results block carries the search controls in its own sidebar, so the page's plain
      // `booking` section is replaced rather than kept — otherwise the same period and party
      // dropdowns would appear twice, once above the results and once beside them.
      if (has('searchResults')) break
      const at = located.findIndex((l) => l.section.type === 'booking')
      if (at === -1) located.push({ section: { type: 'searchResults' }, pointer: null })
      else located.splice(at, 1, { section: { type: 'searchResults' }, pointer: null })
      break
    }
    case 'lastminutes': {
      if (has('lastminutes')) break
      // The overview carries its own period filter AND the villa results, so it takes the place of
      // the plain search widget the page's JSON asks for — two calendars on one page would only
      // compete. Without such a section it simply goes at the end.
      const at = located.findIndex((l) => l.section.type === 'booking')
      if (at === -1) located.push({ section: { type: 'lastminutes' }, pointer: null })
      else located.splice(at, 1, { section: { type: 'lastminutes' }, pointer: null })
      break
    }
    case 'contact': {
      if (has('form')) break
      // Move the page's own contact copy into the form's info column rather than appending a
      // second block — otherwise the address is printed twice, once by each.
      const lastTextAt = located.map((l, i) => [l, i] as const).reverse().find(([l]) => l.section.type === 'text')
      const intro = lastTextAt ? (located.splice(lastTextAt[1], 1)[0] as { section: TextSection; pointer: string | null }) : undefined
      located.push({ section: { type: 'form', slug: 'contact', intro: intro?.section }, pointer: intro?.pointer ?? null })
      break
    }
    case 'sitemap':
      if (!has('sitemap')) located.push({ section: { type: 'sitemap' }, pointer: null })
      break
    default:
      break
  }
  return (
    <Sections
      sections={located.map((l) => l.section)}
      pointers={located.map((l) => l.pointer)}
      ctx={ctx}
    />
  )
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
  return <Shell locale={locale}>{renderPage(page, await buildCtx(locale, await searchParams, 'pages.json'), slug)}</Shell>
}
