import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'

import { BlogFilterState } from '@/components/BlogFilterState'
import { BlogIndex } from '@/components/BlogIndex'
import { Breadcrumb } from '@/components/Breadcrumb'
import { JsonLd } from '@/components/JsonLd'
import { Sections, type RenderCtx, type SectionOpts } from '@/components/sections'
import { Shell } from '@/components/Shell'
import { pageTrail } from '@/content/breadcrumbs'
import { buildCtx } from '@/content/ctx'
import { applyBlogQuery, featuredBlog, parseBlogQuery } from '@/lib/blog-query'
import { pageEquivalents } from '@/content/equivalents'
import { getPage, getPageSlugs } from '@/content/pages'
import { getSite } from '@/content/site'
import { activeLocales } from '@/lib/i18n'
import { breadcrumbList, graph } from '@/lib/jsonld'
import { ogImageForPage } from '@/lib/og-image'
import { pageHeading } from '@/lib/page-heading'
import { metadataFrom } from '@/lib/seo'
import { t } from '@/lib/ui-text'
import { publicPath } from '@/lib/urls'
import type { CollectionSection, PageContent, Section, TextSection } from '@/lib/types'

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
    // `page.sections`, not the `kind`-expanded list: the sections added there (the booking widget, the
    // generated sitemap, the contact form) carry no photograph, so searching them would find nothing
    // while making the share image depend on rendering logic rather than on editable content.
    ogImageForPage(page.seo?.ogImage, page.sections),
  )
}

/**
 * Build the section list for a `pages.json` entry according to its `kind`. Most kinds only ADD a
 * section to whatever the page already has — the contact page gets the form, the sitemap page gets
 * the generated index — so the editable content stays in charge of the rest of the layout.
 */
function pageSections(page: PageContent): Section[] {
  const sections: Section[] = [...page.sections]
  const has = (type: Section['type']) => sections.some((s) => s.type === type)

  switch (page.kind) {
    case 'villas-hub':
      if (!has('collection')) sections.push({ type: 'collection', source: 'villas', title: page.title, linkLabel: '' })
      break
    case 'blogs-hub':
      /**
       * The blog hub does NOT get a `collection` section: it is rendered by <BlogIndex> instead, which
       * adds the search, topic filters, featured article, result count, reset and paging the brief asks
       * for. Any `collection` section the content already has is dropped for the same reason — it would
       * print a second, unfiltered copy of the same 57 cards below the real index.
       */
      return sections.filter((s) => !(s.type === 'collection' && s.source === 'blogs'))
    case 'booking':
    case 'lastminutes':
      if (!has('booking')) sections.push({ type: 'booking', widget: 'zoeken', accommodationId: '' })
      break
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

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const page = getPage(locale, slug)
  if (!page) notFound()

  const ctx: RenderCtx = buildCtx(locale)
  const site = getSite(locale)
  const sections = pageSections(page)
  const isBlogHub = page.kind === 'blogs-hub'

  /**
   * Give the page exactly one <h1>.
   *
   * Audit finding: every `pages.json` hero stores `title: ""` and `HeroBlock` rendered its title as a
   * <p>, so all of these pages shipped with NO h1 and a heading tree starting at <h2>. `pageHeading`
   * recovers the heading the page ALREADY displays — no new copy — and it is rendered as the <h1> in
   * the hero, suppressing the now-duplicate heading at its old position.
   *
   * Note `pageHeading` runs on the FINAL section list (after `pageSections`), so it sees the sections
   * that actually render. That matters for the contact page, where the text section is moved inside
   * the form: it is no longer a top-level section, so its title can't be promoted from there and the
   * page falls through to its own title instead.
   */
  // The blog hub's heading used to come from its `collection` section title ("Blogs"), which
  // `pageSections` now removes in favour of <BlogIndex>. Pass that title through as the fallback so the
  // hub keeps the exact same <h1> text it had before — no new copy, no lost heading.
  const removedBlogCollection = isBlogHub
    ? page.sections.find((s): s is CollectionSection => s.type === 'collection' && s.source === 'blogs')
    : undefined
  const headingFallback = removedBlogCollection?.title || page.title

  const heading = pageHeading(sections, headingFallback)
  const crumbLabel = t(locale, 'breadcrumb')
  // The trail names this page by its H1, not by its SEO title (which carries a "| brand" suffix).
  const trail = pageTrail(locale, slug, site.brandName, heading.text)

  const opts: Record<number, SectionOpts> = {}

  /**
   * Villa hub: switch on the filter row above the villa grid. Marked per SECTION index, so a `collection`
   * section elsewhere on the site (the homepage strip, the article footer) stays an unfiltered grid.
   */
  if (page.kind === 'villas-hub') {
    sections.forEach((sec, i) => {
      if (sec.type === 'collection' && sec.source === 'villas') opts[i] = { ...opts[i], filterable: true }
    })
  }

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
     * `/suchen-buchen`) are just an empty text section plus the Tommy widget. Give the page its
     * heading by filling that empty text section's title with the page's own (SEO-stripped) title,
     * so the h1 lands above the widget instead of nowhere.
     */
    const target = sections.findIndex((s) => s.type === 'text' || s.type === 'textImage')
    if (target >= 0) {
      const s = sections[target]
      if ((s.type === 'text' || s.type === 'textImage') && !s.title.trim()) {
        sections[target] = { ...s, title: heading.text }
      }
      opts[target] = { headingLevel: 1 }
    }
  }

  const jsonld = graph([breadcrumbList(locale, trail)])

  /**
   * Blog hub: the searchable, filterable index replaces the plain card grid.
   *
   * Filtering happens here, on the server, from the query string — so every filter state is a real URL,
   * the articles are in the HTML for crawlers, and the whole thing works with JavaScript off. See
   * `lib/blog-query.ts` and `components/BlogIndex.tsx`.
   */
  let blogIndex: ReactNode = null
  if (isBlogHub) {
    const base = ctx.blogBase || `/${slug}`
    // `publicPath` applies the same locale/prefix rules the router uses, so the search form posts back
    // to the hub in the CURRENT language and mode.
    const formAction = publicPath(locale, base)
    const query = parseBlogQuery(locale, undefined)
    const { searchMatched, filtered } = applyBlogQuery(locale, ctx.blogs, query)

    /**
     * The FALLBACK is the complete, unfiltered index, rendered on the server.
     *
     * That is deliberate, not a placeholder: it is what ends up in the static HTML, so a crawler and a
     * visitor without JavaScript get every article card, the featured article and the full crawlable
     * link list. `BlogFilterState` then re-renders the same index with `?q=&topic=&page=` applied once
     * JS runs.
     *
     * Reading the query string in a client component (rather than via the route's `searchParams`) is
     * what keeps this page STATIC — see the note in BlogFilterState.tsx.
     */
    blogIndex = (
      <Suspense
        fallback={
          <BlogIndex
            locale={locale}
            blogs={ctx.blogs}
            base={base}
            formAction={formAction}
            query={query}
            searchMatched={searchMatched}
            filtered={filtered}
            featured={featuredBlog(ctx.blogs)}
          />
        }
      >
        <BlogFilterState locale={locale} blogs={ctx.blogs} base={base} formAction={formAction} />
      </Suspense>
    )
  }

  return (
    <Shell locale={locale}>
      <JsonLd json={jsonld} />
      {/* Pages without a hero image show the trail on the light background, above the content. */}
      {!hasHeroH1 && trail.length > 1 && (
        <div className="container crumbs--standalone">
          <Breadcrumb trail={trail} label={t(locale, 'breadcrumb')} />
        </div>
      )}
      <Sections sections={sections} ctx={ctx} opts={opts} />
      {blogIndex}
    </Shell>
  )
}
