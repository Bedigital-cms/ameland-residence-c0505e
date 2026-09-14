import { getSite } from '@/content/site'
import { canonicalOriginForLocale } from '@/lib/i18n'
import type { BlogContent, VillaContent } from '@/lib/types'

/**
 * Server-rendered JSON-LD. Only truthful data already in the site/content is used — no invented
 * ratings, prices or facts. All URLs/images are absolute production URLs (per-domain www origin).
 */

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe here (no user HTML); escape `<` defensively.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

/** Absolute production URL for a `/media/<file>` path (or pass through an already-absolute URL). */
function absMedia(origin: string, path: string | undefined): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//.test(path)) return path
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}

function organizationNode(locale: string, origin: string) {
  const site = getSite(locale)
  const f = site.footer
  const address = Array.isArray(f?.address) ? f.address : []
  return {
    '@type': ['Organization', 'LodgingBusiness'],
    '@id': `${origin}/#organization`,
    name: site.brandName,
    url: `${origin}/`,
    ...(site.logo ? { logo: absMedia(origin, site.logo) } : {}),
    ...(f?.email ? { email: f.email } : {}),
    ...(f?.phone ? { telephone: f.phone } : {}),
    ...(f?.socials?.length ? { sameAs: f.socials.map((s) => s.url).filter(Boolean) } : {}),
    ...(address.length
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: address[1] ?? address[0],
            addressLocality: address[2] ?? '',
            addressCountry: 'NL',
          },
        }
      : {}),
    areaServed: 'Ameland',
  }
}

export function SiteJsonLd({ locale }: { locale: string }) {
  const origin = canonicalOriginForLocale(locale)
  if (!origin) return null
  const site = getSite(locale)
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(locale, origin),
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: `${origin}/`,
        name: site.brandName,
        inLanguage: locale === 'de' ? 'de-DE' : 'nl-NL',
        publisher: { '@id': `${origin}/#organization` },
      },
    ],
  }
  return <JsonLd data={graph} />
}

export function VillaJsonLd({ locale, villa, path }: { locale: string; villa: VillaContent; path: string }) {
  const origin = canonicalOriginForLocale(locale)
  if (!origin) return null
  const site = getSite(locale)
  const url = `${origin}${path}`
  const image = absMedia(origin, villa.cardImage)
  const hubLabel = path.split('/').filter(Boolean)[0] ?? ''
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LodgingBusiness',
        '@id': `${url}#lodging`,
        name: villa.title,
        url,
        ...(image ? { image } : {}),
        ...(villa.cardText ? { description: villa.cardText } : {}),
        containedInPlace: { '@type': 'Place', name: 'Ameland' },
        brand: { '@id': `${origin}/#organization` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: site.brandName, item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: hubLabel, item: `${origin}/${hubLabel}` },
          { '@type': 'ListItem', position: 3, name: villa.title, item: url },
        ],
      },
    ],
  }
  return <JsonLd data={graph} />
}

export function BlogJsonLd({ locale, blog, path }: { locale: string; blog: BlogContent; path: string }) {
  const origin = canonicalOriginForLocale(locale)
  if (!origin) return null
  const site = getSite(locale)
  const url = `${origin}${path}`
  const image = absMedia(origin, blog.image || blog.cardImage)
  const hubLabel = path.split('/').filter(Boolean)[0] ?? 'blogs'
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        headline: blog.title,
        ...(blog.excerpt ? { description: blog.excerpt } : {}),
        ...(image ? { image } : {}),
        url,
        inLanguage: locale === 'de' ? 'de-DE' : 'nl-NL',
        author: { '@id': `${origin}/#organization` },
        publisher: { '@id': `${origin}/#organization` },
        mainEntityOfPage: url,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: site.brandName, item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Blogs', item: `${origin}/${hubLabel}` },
          { '@type': 'ListItem', position: 3, name: blog.title, item: url },
        ],
      },
    ],
  }
  return <JsonLd data={graph} />
}
