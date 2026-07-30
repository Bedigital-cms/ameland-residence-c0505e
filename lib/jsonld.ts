/**
 * Server-rendered JSON-LD structured data.
 *
 * Every builder here reads the SAME content the page renders — `site.json`, `villas.json`,
 * `blogs.json`, `pages.json` — so the markup can never drift from what a visitor sees. Nothing is
 * inferred, derived from a heuristic, or defaulted to a plausible value:
 *
 *   · no prices, ratings, availability or review counts (the booking data lives in Tommy, a
 *     third-party widget, and is not part of the page content);
 *   · no authors or publication dates for articles — `BlogContent` has no such fields, so claiming
 *     them would be fabrication (see `blogPosting` below);
 *   · guest capacity / bedrooms / bathrooms only when a villa's own `features` text states them,
 *     parsed conservatively and omitted entirely when ambiguous (see `lib/villa-facts.ts`).
 *
 * Fields that would be empty are dropped rather than emitted as "" or null, because an empty
 * property is a validation warning and tells a crawler nothing.
 *
 * Server-only: called from Server Components, output injected as a <script type="application/ld+json">.
 */
import type { BlogContent, SiteContent, VillaContent } from './types'
import { absoluteUrl, siteOrigin } from './urls'
import { villaFacts } from './villa-facts'

/** A JSON-LD node. Loose by design — shapes vary per @type. */
export type JsonLd = Record<string, unknown>

/** Drop keys whose value is undefined, "", or an empty array — never emit hollow properties. */
function compact<T extends JsonLd>(obj: T): T {
  const out: JsonLd = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out as T
}

/** Turn a "/media/x.jpg" content path into an absolute URL when the origin is known. */
function mediaUrl(locale: string, path: string | undefined): string | undefined {
  const p = (path || '').trim()
  if (!p) return undefined
  if (/^https?:\/\//i.test(p)) return p
  const origin = siteOrigin(locale)
  return origin ? `${origin}${p}` : undefined
}

function mediaUrls(locale: string, paths: (string | undefined)[]): string[] {
  return paths.map((p) => mediaUrl(locale, p)).filter((u): u is string => !!u)
}

/* ------------------------------------------------------------------ general */

/** Stable @id anchors so nodes can reference each other instead of duplicating themselves. */
export const orgId = (locale: string) => `${absoluteUrl(locale, '/')}#organization`
export const siteId = (locale: string) => `${absoluteUrl(locale, '/')}#website`

/**
 * Organization — the business behind the site, from `site.json`'s brand + footer block (the same
 * name, address, email and phone the footer prints).
 */
export function organization(locale: string, site: SiteContent): JsonLd {
  const [, street, postalCity] = site.footer.address ?? []
  // Address lines are "Ameland Residence" / "Appelhof 9" / "8525 GJ Langweer" — split the last line
  // into postcode + city only when it matches the Dutch format, else leave it as the locality.
  const m = (postalCity || '').match(/^\s*(\d{4}\s*[A-Za-z]{2})\s+(.+?)\s*$/)
  const address = compact({
    '@type': 'PostalAddress',
    streetAddress: street || undefined,
    postalCode: m ? m[1].replace(/\s+/g, ' ').trim() : undefined,
    addressLocality: m ? m[2] : postalCity || undefined,
    addressCountry: 'NL',
  })

  return compact({
    '@type': 'Organization',
    '@id': orgId(locale),
    name: site.brandName,
    url: absoluteUrl(locale, '/'),
    logo: mediaUrl(locale, site.logo),
    email: site.footer.email || undefined,
    telephone: site.footer.phone || undefined,
    address: Object.keys(address).length > 1 ? address : undefined,
    sameAs: (site.footer.socials ?? []).map((s) => s.url).filter((u) => /^https?:\/\//i.test(u)),
  })
}

/** WebSite — the site itself, in this language, published by the Organization above. */
export function website(locale: string, site: SiteContent): JsonLd {
  return compact({
    '@type': 'WebSite',
    '@id': siteId(locale),
    name: site.brandName,
    url: absoluteUrl(locale, '/'),
    inLanguage: locale,
    publisher: { '@id': orgId(locale) },
  })
}

/**
 * BreadcrumbList from an already-built trail. Takes the SAME items the visible <Breadcrumb> renders,
 * so the two cannot disagree — the document requires structured data to match visible content.
 */
export function breadcrumbList(locale: string, trail: { name: string; path: string }[]): JsonLd | undefined {
  if (trail.length < 2) return undefined // a single "Home" crumb is not a trail worth marking up
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(locale, c.path),
    })),
  }
}

/* ------------------------------------------------------------------- villas */

/**
 * VacationRental for a villa page.
 *
 * Text comes from the villa's own `cardText`/`paragraphs`; images from its hero + gallery. The
 * numeric and boolean facts (occupancy, bedrooms, bathrooms, pets, sauna, parking, EV charging) are
 * read out of the villa's own `features`/`highlights`/`usps` lines by `villaFacts`, which only
 * reports a fact it can state verbatim from the content and omits everything else.
 *
 * Deliberately absent: price, availability, rating, review count. That data is not on the page.
 */
export function vacationRental(
  locale: string,
  slug: string,
  villa: VillaContent,
  path: string,
  site: SiteContent,
): JsonLd {
  const facts = villaFacts(villa)
  const url = absoluteUrl(locale, path)

  const amenities = facts.amenities.map((a) =>
    compact({ '@type': 'LocationFeatureSpecification', name: a.name, value: a.value }),
  )

  return compact({
    '@type': 'VacationRental',
    '@id': `${url}#accommodation`,
    name: villa.title,
    url,
    // The card text is the villa's own one-paragraph summary — the closest thing to a description
    // the content model has, and it is visible on every villa grid.
    description: villa.cardText || undefined,
    image: mediaUrls(locale, [...(villa.hero?.images ?? []), ...(villa.gallery ?? [])]).slice(0, 12),
    inLanguage: locale,
    identifier: slug,
    // Location: the island is stated on every villa page; the specific village comes from the
    // content only when `villaFacts` found it named there.
    address: compact({
      '@type': 'PostalAddress',
      addressLocality: facts.locality,
      addressRegion: 'Friesland',
      addressCountry: 'NL',
    }),
    containedInPlace: compact({ '@type': 'Place', name: facts.locality ? `${facts.locality}, Ameland` : 'Ameland' }),
    numberOfRooms: facts.bedrooms,
    numberOfBedrooms: facts.bedrooms,
    numberOfBathroomsTotal: facts.bathrooms,
    occupancy: facts.guests ? { '@type': 'QuantitativeValue', value: facts.guests, unitText: 'guests' } : undefined,
    petsAllowed: facts.petsAllowed,
    amenityFeature: amenities,
    provider: { '@id': orgId(locale) },
    brand: site.brandName,
  })
}

/* -------------------------------------------------------------------- blogs */

/**
 * BlogPosting for an article.
 *
 * `BlogContent` has NO author, datePublished or dateModified field, and the old site exposed none
 * either — so those properties are omitted rather than invented (the task document calls this out
 * explicitly: use them "only when they are genuinely available"). If the CMS gains real date/author
 * fields later, add them here; do not backfill from file mtimes or build time, which would be a
 * fabricated claim about when the article was written.
 */
export function blogPosting(locale: string, blog: BlogContent, path: string): JsonLd {
  const url = absoluteUrl(locale, path)
  return compact({
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: blog.title,
    description: blog.excerpt || undefined,
    image: mediaUrls(locale, [blog.image, blog.cardImage]),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: locale,
    isPartOf: { '@id': siteId(locale) },
    publisher: { '@id': orgId(locale) },
    // No `author`: the content model has no author field. An organisation-as-author claim would be
    // an assumption, and a wrong author is treated as worse than a missing one.
  })
}

/* --------------------------------------------------------------------- FAQ */

/**
 * FAQPage from a page's own accordion blocks. Only called when a page genuinely renders visible
 * FAQ items; the answers are the same HTML the accordion shows, reduced to text.
 */
export function faqPage(items: { q: string; a: string[] }[]): JsonLd | undefined {
  const qs = items
    .map((it) => ({ q: (it.q || '').trim(), a: it.a.map(stripHtml).join(' ').trim() }))
    .filter((it) => it.q && it.a)
  if (!qs.length) return undefined
  return {
    '@type': 'FAQPage',
    mainEntity: qs.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  }
}

/** Reduce the CMS's limited HTML subset to plain text for JSON-LD string fields. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Wrap nodes in one `@graph` document. A single script per page with cross-referenced @ids is
 * cleaner for crawlers than several disconnected blocks, and lets Organization/WebSite be declared
 * once and referenced by @id from the page-level node.
 */
export function graph(nodes: (JsonLd | undefined)[]): string {
  const list = nodes.filter((n): n is JsonLd => !!n)
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': list })
}
